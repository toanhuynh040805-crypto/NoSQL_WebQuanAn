import { Router } from 'express';
import { z } from 'zod';
import { redis } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { DiningTable } from '../models/DiningTable.js';
import { TableSession } from '../models/TableSession.js';
import { Reservation } from '../models/Reservation.js';
import { Promotion } from '../models/Promotion.js';
import { withResourceLock } from '../services/resourceLock.js';
import { refreshOrderTable } from '../services/tableState.js';
import { validateOrderTransition } from '../services/orderWorkflow.js';
import { cartOwner, clearCart, readCart } from '../services/cart.js';
import { recordOrderGraph } from '../services/graph.js';
import { notifyRoles, notifyUser } from '../services/notifications.js';
import { calculatePromotion } from '../services/promotions.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
const orderMutation = handler => asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select('tableSession').lean();
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  const key = order.tableSession ? 'payment:confirm:session:' + order.tableSession : 'payment:confirm:order:' + req.params.id;
  return withResourceLock(key, () => handler(req, res));
});

router.post('/', requireAuth, asyncHandler(async (req, res) => withResourceLock('checkout:user:' + req.user._id, async () => {
  const body = z.object({
    orderType: z.enum(['dine-in', 'takeaway']).default('dine-in'),
    tableNumber: z.string().trim().max(20).optional(),
    note: z.string().trim().max(300).default(''),
    promotionCode: z.string().trim().max(30).optional(),
    paymentMethod: z.enum(['cash', 'bank-transfer', 'counter']).default('counter'),
    clientRequestId: z.string().uuid().optional()
  }).parse(req.body);
  if (body.clientRequestId) {
    const previous = await Order.findOne({ customer: req.user._id, clientRequestId: body.clientRequestId });
    if (previous) return res.json({ order: previous, duplicate: true });
  }
  const checkout = async () => {
  if (body.orderType === 'dine-in' && !body.tableNumber) throw new AppError(400, 'Vui lòng nhập số bàn');
  let diningTable = null;
  if (body.orderType === 'dine-in') {
    diningTable = await DiningTable.findOne({ name: body.tableNumber, status: { $in: ['available', 'occupied'] } });
    if (!diningTable) throw new AppError(400, 'Bàn không tồn tại hoặc đã ngừng sử dụng');
  }
  if (diningTable) {
    const activeSession = await TableSession.exists({ table: diningTable._id, status: 'active' });
    if (activeSession) throw new AppError(409, 'Bàn đang được nhân viên phục vụ. Vui lòng gọi thêm món qua nhân viên');
    const otherGuest = await Order.exists({ tableNumber: body.tableNumber, customer: { $ne: req.user._id }, status: { $ne: 'cancelled' }, $or: [{ status: { $ne: 'completed' } }, { paymentStatus: 'pending' }] });
    if (otherGuest) throw new AppError(409, 'Bàn đang có khách khác sử dụng');
    const due = await Reservation.exists({ table: diningTable._id, customer: { $ne: req.user._id }, status: 'confirmed', reservedAt: { $gte: new Date(Date.now() - 1800000), $lte: new Date(Date.now() + 1800000) } });
    if (due) throw new AppError(409, 'Bàn đang được giữ cho khách đã đặt trước');
  }
  const owner = cartOwner(req);
  const cart = await readCart(owner);
  if (!cart.length) throw new AppError(400, 'Giỏ hàng đang trống');

  const foods = await Food.find({ _id: { $in: cart.map(item => item.foodId) }, isAvailable: true });
  const foodMap = new Map(foods.map(food => [food.id, food]));
  const items = cart.map(cartItem => {
    const food = foodMap.get(cartItem.foodId);
    if (!food) throw new AppError(409, `Món ${cartItem.name} không còn phục vụ`);
    return { food: food._id, name: food.name, price: food.price, quantity: cartItem.quantity, note: cartItem.note };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { promotion, discountAmount } = await calculatePromotion(body.promotionCode, subtotal);
  const totalAmount = subtotal - discountAmount;
  const orderCode = `OD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const order = await Order.create({
    orderCode, customer: req.user._id, clientRequestId: body.clientRequestId, items, subtotal, discountAmount, totalAmount,
    promotionCode: promotion?.code, paymentMethod: body.paymentMethod,
    orderType: body.orderType, tableNumber: body.tableNumber, note: body.note,
    statusHistory: [{ status: 'pending' }]
  });
  await clearCart(owner);
  await Promise.allSettled([
    ...items.map(item => Food.updateOne({ _id: item.food }, { $inc: { soldCount: item.quantity } })),
    ...items.map(item => redis.zIncrBy('leaderboard:foods', item.quantity, String(item.food))),
    promotion ? Promotion.updateOne({ _id: promotion._id }, { $inc: { usedCount: 1 } }) : Promise.resolve(),
    diningTable ? DiningTable.updateOne({ _id: diningTable._id }, { status: 'occupied' }) : Promise.resolve(),
    recordOrderGraph(req.user, order),
    notifyRoles(['admin', 'staff', 'kitchen'], {
      type: 'order', title: 'Có đơn hàng mới',
      message: `${order.orderCode} gồm ${items.length} món`, link: '/operations?tab=orders'
    })
  ]);
  res.status(201).json({ order });
  };
  return body.orderType === 'dine-in' ? withResourceLock('table:claim:' + body.tableNumber, checkout) : checkout();
})));

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ orders });
}));

router.get('/queue', requireAuth, requireRole('admin', 'staff', 'kitchen', 'cashier'), asyncHandler(async (req, res) => {
  const filter = req.query.status && req.query.status !== 'all'
    ? { status: req.query.status }
    : { status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } };
  const orders = await Order.find(filter).populate('customer', 'fullName phone email').sort({ createdAt: 1 }).limit(200).lean();
  res.json({ orders });
}));

router.patch('/:id/cancel', requireAuth, orderMutation(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  if (order.status !== 'pending') throw new AppError(409, 'Chỉ có thể hủy đơn đang chờ xác nhận');
  if (order.paymentStatus === 'paid') throw new AppError(409, 'Đơn đã thanh toán, phải xử lý hoàn tiền trước');
  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', changedAt: new Date() });
  await order.save();
  await refreshOrderTable(order.tableNumber);
  res.json({ order });
}));

router.patch('/:id/status', requireAuth, requireRole('admin', 'staff', 'kitchen', 'cashier'), orderMutation(async (req, res) => {
  const { status } = z.object({
    status: z.enum(['confirmed', 'preparing', 'ready', 'completed', 'cancelled'])
  }).parse(req.body);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  validateOrderTransition(order, status, req.user.role);
  order.status = status;
  order.statusHistory.push({ status, changedAt: new Date() });
  await order.save();
  await refreshOrderTable(order.tableNumber);
  if (order.customer) await notifyUser(order.customer, {
    type: 'order', title: 'Cập nhật đơn hàng',
    message: `Đơn ${order.orderCode} đã chuyển sang trạng thái ${status}`,
    link: '/orders'
  });
  res.json({ order });
}));

router.patch('/:id/payment', requireAuth, requireRole('admin', 'cashier'), asyncHandler(async () => {
  throw new AppError(410, 'Vui lòng thanh toán qua /api/payments/order/:id/confirm hoặc /api/payments/session/:id/confirm');
}));

export default router;
