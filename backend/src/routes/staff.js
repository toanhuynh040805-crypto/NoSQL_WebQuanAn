import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { redis } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { Reservation } from '../models/Reservation.js';
import { TableSession } from '../models/TableSession.js';
import { User } from '../models/User.js';
import { notifyRoles } from '../services/notifications.js';
import { withResourceLock } from '../services/resourceLock.js';
import { recordOrderGraph } from '../services/graph.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'staff', 'cashier'));

const lockKey = sessionId => 'table:lock:' + sessionId;
const lockSeconds = 300;
const tableClaim = handler => asyncHandler(async (req, res) => {
  const table = await DiningTable.findById(validId(req.params.id)).select('name').lean();
  if (!table) throw new AppError(404, 'Không tìm thấy bàn');
  return withResourceLock('table:claim:' + table.name, () => handler(req, res));
});
const sessionAction = handler => asyncHandler(async (req, res) => {
  const sessionId = req.params.index !== undefined
    ? (await Order.findById(validId(req.params.id)).select('tableSession').lean())?.tableSession
    : validId(req.params.id);
  if (!sessionId) throw new AppError(404, 'Không tìm thấy phiên bàn');
  return withResourceLock('payment:confirm:session:' + sessionId, () => handler(req, res));
});
const validId = id => {
  if (!isValidObjectId(id)) throw new AppError(400, 'Mã dữ liệu không hợp lệ');
  return id;
};
const activeReservationFilter = () => ({
  status: 'confirmed', reservedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
});
const dueReservationFilter = () => ({
  status: 'confirmed',
  reservedAt: {
    $gte: new Date(Date.now() - 30 * 60 * 1000),
    $lte: new Date(Date.now() + 30 * 60 * 1000)
  }
});

async function getLock(sessionId) {
  const ownerId = await redis.get(lockKey(sessionId));
  if (!ownerId) return null;
  const [owner, ttl] = await Promise.all([
    User.findById(ownerId).select('fullName').lean(),
    redis.ttl(lockKey(sessionId))
  ]);
  return { ownerId, ownerName: owner?.fullName || 'Nhân viên khác', secondsLeft: Math.max(0, ttl) };
}

async function getActiveSession(id) {
  const session = await TableSession.findOne({ _id: validId(id), status: 'active' })
    .populate('openedBy', 'fullName').populate('reservation', 'reservationCode').populate('customer', 'fullName phone email loyaltyPoints');
  if (!session) throw new AppError(404, 'Phiên bàn đã kết thúc hoặc không tồn tại');
  return session;
}

router.get('/tables', asyncHandler(async (_req, res) => {
  const [tables, sessions, reservations] = await Promise.all([
    DiningTable.find({ status: { $ne: 'inactive' } }).sort({ area: 1, name: 1 }).lean(),
    TableSession.find({ status: 'active' }).select('table tableNumber guestCount customerName openedBy openedAt createdAt').lean(),
    Reservation.find(activeReservationFilter()).sort({ reservedAt: 1 }).select('table reservationCode reservedAt guestCount customerName').lean()
  ]);
  const sessionByTable = new Map(sessions.map(session => [String(session.table), session]));
  const reservationByTable = new Map();
  for (const item of reservations) {
    const key = String(item.table || '');
    if (key && !reservationByTable.has(key)) reservationByTable.set(key, item);
  }
  res.json({
    tables: tables.map(table => ({
      ...table,
      activeSession: sessionByTable.get(String(table._id)) || null,
      nextReservation: reservationByTable.get(String(table._id)) || null
    }))
  });
}));

router.get('/sessions/:id', asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  const [orders, lock] = await Promise.all([
    Order.find({ tableSession: session._id }).sort({ createdAt: 1 }).lean(),
    getLock(String(session._id))
  ]);
  res.json({
    session, orders, lock,
    subtotal: orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0),
    unpaid: orders.filter(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid').length
  });
}));

router.post('/tables/:id/open', requireRole('admin', 'staff'), tableClaim(async (req, res) => {
  const body = z.object({
    guestCount: z.coerce.number().int().min(1).max(50),
    customerName: z.string().trim().max(100).default(''),
    customerId: z.string().refine(isValidObjectId, 'Mã khách hàng không hợp lệ').optional(),
    reservationId: z.string().optional()
  }).parse(req.body);
  const table = await DiningTable.findById(validId(req.params.id));
  if (!table || !['available', 'reserved'].includes(table.status)) {
    throw new AppError(409, 'Bàn không trống hoặc đã có phiên phục vụ');
  }
  if (body.guestCount > table.capacity) throw new AppError(400, 'Số khách vượt sức chứa bàn');

  let reservation = null;
  if (body.reservationId) {
    reservation = await Reservation.findOne({
      _id: validId(body.reservationId), table: table._id, ...dueReservationFilter()
    });
    if (!reservation) throw new AppError(409, 'Chỉ nhận bàn đặt đã xác nhận trong vòng 30 phút quanh giờ hẹn');
    if (body.guestCount !== reservation.guestCount) throw new AppError(409, 'Số khách không khớp lịch đặt bàn');
  } else {
    if (table.status === 'reserved') throw new AppError(409, 'Bàn đã được giữ cho lịch đặt trước');
    const due = await Reservation.exists({ table: table._id, ...dueReservationFilter() });
    if (due) throw new AppError(409, 'Bàn có khách đặt đến trong vòng 30 phút: hãy nhận đúng lịch đặt');
  }

  // Conditional update ensures two waiters cannot both receive an available table.
  const customerId = body.customerId || reservation?.customer;
  const customer = customerId ? await User.findOne({ _id: customerId, role: 'customer', isActive: true }).select('fullName') : null;
  if (customerId && !customer) throw new AppError(400, 'Khách hàng không tồn tại hoặc tài khoản đã khóa');
  const claimed = await DiningTable.findOneAndUpdate(
    { _id: table._id, status: table.status }, { $set: { status: 'occupied' } }, { new: true }
  );
  if (!claimed) throw new AppError(409, 'Bàn vừa được nhân viên khác nhận. Vui lòng tải lại');

  let session;
  try {
    session = await TableSession.create({
      table: table._id, tableNumber: table.name, guestCount: body.guestCount,
      customer: customer?._id,
      customerName: customer?.fullName || body.customerName || reservation?.customerName || '',
      reservation: reservation?._id, openedBy: req.user._id,
      activity: [{ action: 'open', by: req.user._id, detail: reservation ? 'Nhận bàn đặt' : 'Nhận bàn thường' }]
    });
    if (reservation) {
      reservation.status = 'seated';
      reservation.statusHistory.push({ status: 'seated', changedBy: req.user._id });
      await reservation.save();
    }
    await redis.set(lockKey(String(session._id)), String(req.user._id), { EX: lockSeconds });
  } catch (error) {
    if (!session) {
      await DiningTable.updateOne({ _id: table._id, status: 'occupied' }, { $set: { status: table.status } });
    }
    throw error.code === 11000 ? new AppError(409, 'Bàn đã được nhân viên khác nhận') : error;
  }
  res.status(201).json({ session });
}));

router.post('/sessions/:id/lock', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  if (session.paymentState === 'paid') throw new AppError(409, 'Phiên bàn đã thanh toán, không thể tiếp tục gọi món');
  const key = lockKey(String(session._id));
  const userId = String(req.user._id);
  const acquired = await redis.set(key, userId, { NX: true, EX: lockSeconds });
  if (!acquired) {
    const current = await redis.get(key);
    if (current !== userId) {
      const lock = await getLock(String(session._id));
      throw new AppError(423, 'Bàn đang được ' + (lock?.ownerName || 'nhân viên khác') + ' thao tác');
    }
    await redis.expire(key, lockSeconds);
  }
  res.json({ lock: await getLock(String(session._id)) });
}));

router.delete('/sessions/:id/lock', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const key = lockKey(validId(req.params.id));
  const userId = String(req.user._id);
  await redis.eval(
    'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
    { keys: [key], arguments: [userId] }
  );
  res.status(204).end();
}));

router.post('/sessions/:id/orders', requireRole('admin', 'staff'), sessionAction(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  if (session.paymentState === 'paid') throw new AppError(409, 'Bàn đã thanh toán, không thể gọi món thêm');
  if (await redis.get(lockKey(String(session._id))) !== String(req.user._id)) {
    throw new AppError(423, 'Bạn cần giữ quyền thao tác bàn trước khi gọi món');
  }
  const body = z.object({
    items: z.array(z.object({
      foodId: z.string().refine(isValidObjectId, 'Mã món không hợp lệ'),
      quantity: z.coerce.number().int().min(1).max(99),
      note: z.string().trim().max(200).default('')
    })).min(1).max(40),
    note: z.string().trim().max(300).default(''),
    priority: z.enum(['normal', 'urgent']).default('normal'),
    clientRequestId: z.string().uuid()
  }).parse(req.body);

  const previous = await Order.findOne({ tableSession: session._id, clientRequestId: body.clientRequestId });
  if (previous) return res.json({ order: previous, duplicate: true });

  const availableFoods = await Food.find({
    _id: { $in: body.items.map(i => i.foodId) }, isAvailable: true
  }).lean();
  const foodById = new Map(availableFoods.map(food => [String(food._id), food]));
  const items = body.items.map(item => {
    const food = foodById.get(item.foodId);
    if (!food) throw new AppError(409, 'Một món đã hết hoặc không còn phục vụ');
    return { food: food._id, name: food.name, price: food.price, quantity: item.quantity, note: item.note };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let order;
  try {
    order = await Order.create({
      orderCode: 'OD-' + randomUUID().slice(0, 12).toUpperCase(),
      source: 'staff', createdBy: req.user._id, tableSession: session._id,
      customer: session.customer?._id || session.customer,
      clientRequestId: body.clientRequestId, orderType: 'dine-in', tableNumber: session.tableNumber,
      items, note: body.note, priority: body.priority, subtotal, totalAmount: subtotal,
      status: 'confirmed', statusHistory: [{ status: 'confirmed' }]
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Order.findOne({ tableSession: session._id, clientRequestId: body.clientRequestId });
      if (existing) return res.json({ order: existing, duplicate: true });
    }
    throw error;
  }
  await TableSession.updateOne(
    { _id: session._id, status: 'active' },
    { $push: { activity: { action: 'order', by: req.user._id, detail: order.orderCode } } }
  );
  await Promise.allSettled([
    session.customer ? recordOrderGraph(session.customer, order) : Promise.resolve(),
    ...items.map(item => Food.updateOne({ _id: item.food }, { $inc: { soldCount: item.quantity } })),
    ...items.map(item => redis.zIncrBy('leaderboard:foods', item.quantity, String(item.food))),
    notifyRoles(['admin', 'kitchen'], {
      type: 'order', title: 'Bàn ' + session.tableNumber + ' vừa gọi món',
      message: 'Đơn ' + order.orderCode + ' có ' + items.length + ' dòng món',
      link: '/kitchen'
    })
  ]);
  res.status(201).json({ order });
}));


// Staff may change quantities only before kitchen starts preparing the ticket.
// Compare __v to reject concurrent modifications; keep the original price snapshot.
router.patch('/orders/:id/items/:index', requireRole('admin', 'staff'), sessionAction(async (req, res) => {
  const order = await Order.findById(validId(req.params.id));
  if (!order || order.source !== 'staff' || !order.tableSession) throw new AppError(404, 'Không tìm thấy lượt gọi món của nhân viên');
  if (order.status !== 'confirmed') throw new AppError(409, 'Bếp đã bắt đầu xử lý, không được thay đổi món');
  const session = await getActiveSession(String(order.tableSession));
  if (session.paymentState === 'paid') throw new AppError(409, 'Bàn đã thanh toán');
  if (await redis.get(lockKey(String(session._id))) !== String(req.user._id)) {
    throw new AppError(423, 'Cần giữ quyền thao tác bàn để chỉnh món');
  }
  const index = z.coerce.number().int().min(0).parse(req.params.index);
  const { quantity } = z.object({ quantity: z.coerce.number().int().min(0).max(99) }).parse(req.body);
  if (index >= order.items.length) throw new AppError(404, 'Không tìm thấy dòng món');
  const previous = order.items[index];
  const delta = quantity - previous.quantity;
  if (!delta) return res.json({ order });
  const updatedItems = order.items.map(item => item.toObject());
  const cancellingAll = quantity === 0 && updatedItems.length === 1;
  if (quantity === 0 && !cancellingAll) updatedItems.splice(index, 1);
  else if (!cancellingAll) updatedItems[index].quantity = quantity;
  const subtotal = cancellingAll ? 0 : updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const write = await Order.updateOne(
    { _id: order._id, status: 'confirmed', __v: order.__v },
    {
      $set: {
        ...(cancellingAll ? { status: 'cancelled' } : { items: updatedItems }),
        subtotal, totalAmount: subtotal
      },
      ...(cancellingAll ? { $push: { statusHistory: { status: 'cancelled' } } } : {}),
      $inc: { __v: 1 }
    }
  );
  if (!write.modifiedCount) throw new AppError(409, 'Đơn đã được thay đổi ở nơi khác, vui lòng tải lại');
  await Promise.allSettled([
    Food.updateOne({ _id: previous.food }, { $inc: { soldCount: delta } }),
    redis.zIncrBy('leaderboard:foods', delta, String(previous.food))
  ]);
  await TableSession.updateOne({ _id: session._id }, {
    $push: { activity: {
      action: 'adjust-item', by: req.user._id,
      detail: order.orderCode + ' · ' + previous.name + ': ' + previous.quantity + ' → ' + quantity
    } }
  });
  const updated = await Order.findById(order._id).lean();
  res.json({ order: updated });
}));

// Transfer the entire table session and its order history, never copy/delete order lines.
router.patch('/sessions/:id/transfer', requireRole('admin', 'staff'), sessionAction(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  if (await redis.get(lockKey(String(session._id))) !== String(req.user._id)) {
    throw new AppError(423, 'Bạn phải giữ quyền thao tác bàn trước khi chuyển');
  }
  if (session.reservation) throw new AppError(409, 'Bàn nhận từ lịch đặt cần được quản lý xử lý trước khi chuyển');
  if (session.paymentState === 'paid') throw new AppError(409, 'Không thể chuyển bàn sau thanh toán');
  const body = z.object({ destinationTableId: z.string().refine(isValidObjectId) }).parse(req.body);
  if (String(session.table) === body.destinationTableId) throw new AppError(400, 'Bàn đích trùng bàn hiện tại');
  const destination = await DiningTable.findById(body.destinationTableId);
  if (!destination || destination.status !== 'available') throw new AppError(409, 'Bàn đích đang được sử dụng hoặc giữ chỗ');
  if (destination.capacity < session.guestCount) throw new AppError(409, 'Bàn đích không đủ chỗ');
  const due = await Reservation.exists({ table: destination._id, ...dueReservationFilter() });
  if (due) throw new AppError(409, 'Bàn đích có lịch đặt trong vòng 30 phút');

  const claimed = await DiningTable.findOneAndUpdate(
    { _id: destination._id, status: 'available' },
    { $set: { status: 'occupied' } }, { new: true }
  );
  if (!claimed) throw new AppError(409, 'Bàn đích vừa được người khác nhận');
  const previousTableId = session.table;
  const previousNumber = session.tableNumber;
  let moved;
  try {
    moved = await TableSession.findOneAndUpdate(
      { _id: session._id, status: 'active', table: previousTableId },
      {
        $set: { table: destination._id, tableNumber: destination.name },
        $push: { activity: {
          action: 'transfer', by: req.user._id,
          detail: previousNumber + ' → ' + destination.name
        } }
      }, { new: true, runValidators: true }
    );
    if (!moved) throw new AppError(409, 'Phiên bàn đã thay đổi, vui lòng làm mới');
    await Order.updateMany({ tableSession: session._id }, { $set: { tableNumber: destination.name } });
  } catch (error) {
    if (!moved) await DiningTable.updateOne(
      { _id: destination._id, status: 'occupied' }, { $set: { status: 'available' } }
    );
    throw error.code === 11000 ? new AppError(409, 'Bàn đích đã có phiên khác') : error;
  }
  const nextAtOld = await Reservation.exists({ table: previousTableId, ...dueReservationFilter() });
  await DiningTable.updateOne(
    { _id: previousTableId, status: 'occupied' },
    { $set: { status: nextAtOld ? 'reserved' : 'available' } }
  );
  res.json({ session: moved, previousTable: previousNumber, destination: destination.name });
}));

router.patch('/sessions/:id/close', requireRole('admin', 'cashier'), sessionAction(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  const lockedBy = await redis.get(lockKey(String(session._id)));
  if (lockedBy && String(lockedBy) !== String(req.user._id)) {
    throw new AppError(423, 'Cần yêu cầu nhân viên đang giữ bàn trả quyền trước khi thanh toán xong');
  }
  const orders = await Order.find({ tableSession: session._id, status: { $ne: 'cancelled' } }).lean();
  if (orders.some(o => o.status !== 'completed')) throw new AppError(409, 'Còn món chưa hoàn tất phục vụ');
  if (orders.some(o => o.paymentStatus !== 'paid')) throw new AppError(409, 'Còn hóa đơn chưa thanh toán');
  const closed = await TableSession.findOneAndUpdate(
    { _id: session._id, status: 'active' },
    {
      $set: { status: 'closed', closedAt: new Date(), closedBy: req.user._id },
      $push: { activity: { action: 'close', by: req.user._id, detail: 'Đã kết thúc phiên bàn' } }
    }, { new: true }
  );
  if (!closed) throw new AppError(409, 'Phiên bàn đã đóng');
  const next = await Reservation.findOne({
    table: session.table, ...dueReservationFilter()
  }).sort({ reservedAt: 1 });
  await DiningTable.updateOne(
    { _id: session.table, status: 'occupied' },
    { $set: { status: next ? 'reserved' : 'available' } }
  );
  if (session.reservation) {
    await Reservation.updateOne(
      { _id: session.reservation._id, status: 'seated' },
      { $set: { status: 'completed' }, $push: { statusHistory: { status: 'completed', changedBy: req.user._id } } }
    );
  }
  await redis.del(lockKey(String(session._id)));
  res.json({ session: closed, tableStatus: next ? 'reserved' : 'available' });
}));

export default router;
