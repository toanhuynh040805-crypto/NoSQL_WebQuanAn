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
import { User } from '../models/User.js';
import { cartOwner, clearCart, readCart } from '../services/cart.js';
import { recordOrderGraph } from '../services/graph.js';
import { notifyRoles, notifyUser } from '../services/notifications.js';
import { calculatePromotion } from '../services/promotions.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    orderType: z.enum(['dine-in', 'takeaway']).default('dine-in'),
    tableNumber: z.string().trim().max(20).optional(),
    note: z.string().trim().max(300).default(''),
    promotionCode: z.string().trim().max(30).optional(),
    paymentMethod: z.enum(['cash', 'bank-transfer', 'counter']).default('counter')
  }).parse(req.body);
  if (body.orderType === 'dine-in' && !body.tableNumber) throw new AppError(400, 'Vui lòng nhập số bàn');
  let diningTable = null;
  if (body.orderType === 'dine-in') {
    diningTable = await DiningTable.findOne({ name: body.tableNumber, status: { $ne: 'inactive' } });
    if (!diningTable) throw new AppError(400, 'Bàn không tồn tại hoặc đã ngừng sử dụng');
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
    orderCode, customer: req.user._id, items, subtotal, discountAmount, totalAmount,
    promotionCode: promotion?.code, paymentMethod: body.paymentMethod,
    orderType: body.orderType, tableNumber: body.tableNumber, note: body.note,
    statusHistory: [{ status: 'pending' }]
  });
  await Promise.all([
    ...items.map(item => Food.updateOne({ _id: item.food }, { $inc: { soldCount: item.quantity } })),
    ...items.map(item => redis.zIncrBy('leaderboard:foods', item.quantity, String(item.food))),
    promotion ? Promotion.updateOne({ _id: promotion._id }, { $inc: { usedCount: 1 } }) : Promise.resolve(),
    diningTable ? DiningTable.updateOne({ _id: diningTable._id }, { status: 'occupied' }) : Promise.resolve(),
    clearCart(owner),
    recordOrderGraph(req.user, order),
    notifyRoles(['admin', 'staff', 'kitchen'], {
      type: 'order', title: 'Có đơn hàng mới',
      message: `${order.orderCode} gồm ${items.length} món`, link: '/operations?tab=orders'
    })
  ]);
  res.status(201).json({ order });
}));

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

router.patch('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  if (order.status !== 'pending') throw new AppError(409, 'Chỉ có thể hủy đơn đang chờ xác nhận');
  if (order.paymentStatus === 'paid') throw new AppError(409, 'Đơn đã thanh toán, phải xử lý hoàn tiền trước');
  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', changedAt: new Date() });
  await order.save();
  if (order.tableNumber) {
    const hasSession = await TableSession.exists({ tableNumber: order.tableNumber, status: 'active' });
    const hasOtherOrders = await Order.exists({
      tableNumber: order.tableNumber, _id: { $ne: order._id },
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (!hasSession && !hasOtherOrders) {
      const next = await Reservation.exists({
        table: (await DiningTable.findOne({ name: order.tableNumber }).select('_id'))?._id,
        status: 'confirmed', reservedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
      });
      await DiningTable.updateOne({ name: order.tableNumber }, { status: next ? 'reserved' : 'available' });
    }
  }
  res.json({ order });
}));

router.patch('/:id/status', requireAuth, requireRole('admin', 'staff', 'kitchen', 'cashier'), asyncHandler(async (req, res) => {
  const { status } = z.object({
    status: z.enum(['confirmed', 'preparing', 'ready', 'completed', 'cancelled'])
  }).parse(req.body);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  if (['completed', 'cancelled'].includes(order.status)) throw new AppError(409, 'Đơn hàng đã kết thúc');
  if (status === 'cancelled' && order.paymentStatus === 'paid') {
    throw new AppError(409, 'Đơn đã thanh toán, phải xử lý hoàn tiền trước');
  }
  const allowedByRole = {
    kitchen: ['preparing', 'ready'],
    cashier: ['completed', 'cancelled'],
    staff: ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    admin: ['confirmed', 'preparing', 'ready', 'completed', 'cancelled']
  };
  if (!allowedByRole[req.user.role]?.includes(status)) throw new AppError(403, 'Vai trò không được cập nhật trạng thái này');
  order.status = status;
  order.statusHistory.push({ status, changedAt: new Date() });
  await order.save();
  if (['completed', 'cancelled'].includes(status) && order.tableNumber && !order.tableSession) {
    const hasSession = await TableSession.exists({ tableNumber: order.tableNumber, status: 'active' });
    const hasOtherOrders = await Order.exists({
      tableNumber: order.tableNumber, _id: { $ne: order._id },
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (!hasSession && !hasOtherOrders) {
      const table = await DiningTable.findOne({ name: order.tableNumber }).select('_id');
      const next = table && await Reservation.exists({
        table: table._id, status: 'confirmed',
        reservedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
      });
      await DiningTable.updateOne({ name: order.tableNumber }, { status: next ? 'reserved' : 'available' });
    }
  }
  if (status === 'completed' && order.customer) {
    await User.updateOne({ _id: order.customer }, { $inc: { loyaltyPoints: Math.floor(order.totalAmount / 10000) } });
  }
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
