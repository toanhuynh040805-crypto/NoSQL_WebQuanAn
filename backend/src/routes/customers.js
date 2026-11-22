import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Reservation } from '../models/Reservation.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'cashier', 'staff'));
const writeAccess = requireRole('admin', 'cashier');
const fields = 'fullName email phone address isActive loyaltyPoints createdAt updatedAt';
const profile = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150).transform(value => value.toLowerCase()),
  phone: z.string().trim().max(20).regex(/^[+\d\s().-]*$/, 'Số điện thoại không hợp lệ').default(''),
  address: z.string().trim().max(300).default(''),
  customerNotes: z.string().trim().max(1000).default('')
});
const validId = id => {
  if (!isValidObjectId(id)) throw new AppError(400, 'Mã khách hàng không hợp lệ');
  return id;
};
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function metrics(ids) {
  return Order.aggregate([
    { $match: { customer: { $in: ids } } },
    { $group: {
      _id: '$customer', orderCount: { $sum: 1 },
      paidOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
      totalSpent: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $ne: ['$status', 'cancelled'] }] }, '$totalAmount', 0] } },
      unpaidAmount: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'pending'] }, { $ne: ['$status', 'cancelled'] }] }, '$totalAmount', 0] } },
      lastOrderAt: { $max: '$createdAt' }
    } }
  ]);
}

router.get('/', asyncHandler(async (req, res) => {
  const query = z.object({
    search: z.string().trim().max(100).default(''),
    state: z.enum(['all', 'active', 'inactive']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12)
  }).parse(req.query);
  const filter = { role: 'customer' };
  if (query.state !== 'all') filter.isActive = query.state === 'active';
  if (query.search) filter.$or = ['fullName', 'phone', 'email'].map(field => ({ [field]: { $regex: escapeRegex(query.search), $options: 'i' } }));
  const [customers, total, counts] = await Promise.all([
    User.find(filter).select(fields).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    User.countDocuments(filter),
    User.aggregate([{ $match: { role: 'customer' } }, { $group: { _id: '$isActive', count: { $sum: 1 } } }])
  ]);
  const stats = new Map((await metrics(customers.map(customer => customer._id))).map(item => [String(item._id), item]));
  res.json({
    customers: customers.map(customer => ({ ...customer, stats: stats.get(String(customer._id)) || { orderCount: 0, paidOrders: 0, totalSpent: 0, unpaidAmount: 0 } })),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
    summary: { total: counts.reduce((sum, item) => sum + item.count, 0), active: counts.find(item => item._id === true)?.count || 0, inactive: counts.find(item => item._id === false)?.count || 0 }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await User.findOne({ _id: validId(req.params.id), role: 'customer' })
    .select(fields + (req.user.role === 'staff' ? '' : ' customerNotes')).lean();
  if (!customer) throw new AppError(404, 'Không tìm thấy khách hàng');
  const [orders, reservations, stats, favoriteFoods] = await Promise.all([
    Order.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Reservation.find({ customer: customer._id }).populate('table', 'name').sort({ reservedAt: -1 }).limit(20).lean(),
    metrics([customer._id]),
    Order.aggregate([
      { $match: { customer: customer._id, paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
      { $unwind: '$items' }, { $group: { _id: '$items.food', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' } } },
      { $sort: { quantity: -1 } }, { $limit: 5 }
    ])
  ]);
  res.json({ customer, stats: stats[0] || { orderCount: 0, paidOrders: 0, totalSpent: 0, unpaidAmount: 0 }, orders, reservations, favoriteFoods });
}));

router.post('/', writeAccess, asyncHandler(async (req, res) => {
  const body = profile.extend({ password: z.string().min(6).max(72) }).parse(req.body);
  if (await User.exists({ email: body.email })) throw new AppError(409, 'Email đã được sử dụng');
  const { password, ...details } = body;
  const user = await User.create({ ...details, role: 'customer', passwordHash: await bcrypt.hash(password, 11) });
  const customer = await User.findById(user._id).select(fields + ' customerNotes').lean();
  res.status(201).json({ customer });
}));

router.patch('/:id', writeAccess, asyncHandler(async (req, res) => {
  const parsed = profile.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  const body = Object.fromEntries(Object.keys(req.body).filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]]));
  if (body.isActive !== undefined && req.user.role !== 'admin') throw new AppError(403, 'Chỉ quản trị viên được khóa hoặc mở tài khoản');
  if (!Object.keys(body).length) throw new AppError(400, 'Chưa có thông tin cần cập nhật');
  if (body.email && await User.exists({ email: body.email, _id: { $ne: validId(req.params.id) } })) throw new AppError(409, 'Email đã được sử dụng');
  const customer = await User.findOneAndUpdate(
    { _id: validId(req.params.id), role: 'customer' }, { $set: body }, { new: true, runValidators: true }
  ).select(fields + ' customerNotes').lean();
  if (!customer) throw new AppError(404, 'Không tìm thấy khách hàng');
  res.json({ customer });
}));

export default router;
