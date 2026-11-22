import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { DiningTable } from '../models/DiningTable.js';
import { Reservation } from '../models/Reservation.js';
import { clearMenuCache } from '../services/cache.js';
import { slugify } from '../utils/slug.js';
import { reportRange } from '../utils/reporting.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const menuImageDir = path.resolve(currentDir, '../../public/images/menu');

const foodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  price: z.coerce.number().min(0),
  unit: z.string().trim().max(30).default('Phần'),
  imageUrl: z.string().trim().max(300).default(''),
  category: z.string(),
  tags: z.array(z.string().trim()).default([]),
  isAvailable: z.boolean().default(true)
});

function parsePatch(schema, input) {
  const parsed = schema.partial().parse(input);
  return Object.fromEntries(Object.keys(input).filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]]));
}

router.get('/dashboard', requireRole('admin', 'staff', 'cashier'), asyncHandler(async (req, res) => {
  const { to } = reportRange();
  const startOfDay = new Date(to.getTime() - 86400000 + 1);
  const [users, foods, pendingOrders, today, tables, reservations] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Food.countDocuments(),
    Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } }),
    Order.aggregate([
      { $addFields: { accountingAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
      { $match: { accountingAt: { $gte: startOfDay, $lte: to }, paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]),
    DiningTable.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Reservation.countDocuments({ status: { $in: ['pending', 'confirmed'] }, reservedAt: { $gte: startOfDay } })
  ]);
  res.json({ users, foods, pendingOrders, today: today[0] || { revenue: 0, orders: 0 }, tables, reservations });
}));

router.get('/orders', requireRole('admin', 'staff', 'kitchen', 'cashier'), asyncHandler(async (req, res) => {
  const filter = req.query.status && req.query.status !== 'all' ? { status: req.query.status } : {};
  const orders = await Order.find(filter).populate('customer', 'fullName email phone').sort({ createdAt: -1 }).limit(200).lean();
  res.json({ orders });
}));

router.post('/categories', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(['food', 'drink']).default('food'),
    description: z.string().trim().max(300).default('')
  }).parse(req.body);
  const category = await Category.create({ ...body, slug: slugify(body.name) });
  await clearMenuCache();
  res.status(201).json({ category });
}));

router.put('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    type: z.enum(['food', 'drink']).optional(),
    description: z.string().trim().max(300).optional()
  }).parse(req.body);
  if (body.name) body.slug = slugify(body.name);
  const category = await Category.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!category) throw new AppError(404, 'Không tìm thấy danh mục');
  await clearMenuCache();
  res.json({ category });
}));

router.delete('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (await Food.exists({ category: req.params.id })) throw new AppError(409, 'Không thể xóa danh mục đang có món ăn');
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError(404, 'Không tìm thấy danh mục');
  await clearMenuCache();
  res.status(204).end();
}));

router.post('/foods', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = foodSchema.parse(req.body);
  if (!(await Category.exists({ _id: body.category }))) throw new AppError(400, 'Danh mục không hợp lệ');
  const food = await Food.create({ ...body, slug: `${slugify(body.name)}-${Date.now().toString(36)}` });
  await clearMenuCache();
  res.status(201).json({ food });
}));

router.put('/foods/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = parsePatch(foodSchema, req.body);
  if (body.name) body.slug = `${slugify(body.name)}-${req.params.id.slice(-5)}`;
  const food = await Food.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food });
}));

router.delete('/foods/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const food = await Food.findByIdAndUpdate(req.params.id, { isAvailable: false }, { new: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food, message: 'Đã ngừng phục vụ món ăn' });
}));

router.post('/foods/:id/image', requireRole('admin'), asyncHandler(async (req, res) => {
  const { dataUrl } = z.object({ dataUrl: z.string().max(4_500_000) }).parse(req.body);
  const matched = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!matched) throw new AppError(400, 'Ảnh phải là JPEG, PNG hoặc WebP');
  const extension = matched[1] === 'jpeg' ? 'jpg' : matched[1];
  const buffer = Buffer.from(matched[2], 'base64');
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) throw new AppError(400, 'Ảnh không hợp lệ hoặc lớn hơn 3MB');
  await fs.mkdir(menuImageDir, { recursive: true });
  const filename = `upload-${req.params.id}-${randomUUID().slice(0, 8)}.${extension}`;
  await fs.writeFile(path.join(menuImageDir, filename), buffer);
  const food = await Food.findByIdAndUpdate(req.params.id, { imageUrl: `/images/menu/${filename}` }, { new: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food });
}));

router.get('/users', requireRole('admin'), asyncHandler(async (req, res) => {
  const filter = req.query.role && req.query.role !== 'all' ? { role: req.query.role } : {};
  const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).limit(300).lean();
  res.json({ users });
}));

router.patch('/users/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    role: z.enum(['customer', 'admin', 'staff', 'kitchen', 'cashier']).optional(),
    isActive: z.boolean().optional()
  }).parse(req.body);
  if (String(req.user._id) === req.params.id && (body.isActive === false || (body.role && body.role !== 'admin'))) throw new AppError(400, 'Không thể khóa chính tài khoản đang sử dụng');
  const user = await User.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).select('-passwordHash');
  if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
  res.json({ user });
}));

router.get('/reports', requireRole('admin', 'cashier'), asyncHandler(async (req, res) => {
  const { from, to } = reportRange(req.query);
  const paid = [
    { $addFields: { accountingAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { accountingAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' }, paymentStatus: 'paid' } }
  ];
  const [summary, daily, topFoods, statusCounts] = await Promise.all([
    Order.aggregate([...paid, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, averageOrder: { $avg: '$totalAmount' } } }]),
    Order.aggregate([...paid, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$accountingAt', timezone: 'Asia/Ho_Chi_Minh' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([...paid, { $unwind: '$items' }, { $group: { _id: '$items.food', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity', { $cond: [{ $gt: ['$subtotal', 0] }, { $divide: ['$totalAmount', '$subtotal'] }, 0] }] } } } }, { $sort: { quantity: -1 } }, { $limit: 10 }]),
    Order.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  res.json({ from, to, summary: summary[0] || { revenue: 0, orders: 0, averageOrder: 0 }, daily, topFoods, statusCounts });
}));

export default router;

