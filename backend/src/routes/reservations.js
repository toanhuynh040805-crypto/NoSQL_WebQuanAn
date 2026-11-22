import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { Reservation } from '../models/Reservation.js';
import { TableSession } from '../models/TableSession.js';
import { notifyRoles, notifyUser } from '../services/notifications.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

// Only hold the physical table when a confirmed booking is within the 30-minute arrival window.
async function refreshTableStatus(tableId) {
  if (!tableId) return;
  const activeSession = await TableSession.exists({ table: tableId, status: 'active' });
  const now = Date.now();
  const upcoming = activeSession ? null : await Reservation.exists({
    table: tableId, status: 'confirmed',
    reservedAt: { $gte: new Date(now - 30 * 60 * 1000), $lte: new Date(now + 30 * 60 * 1000) }
  });
  await DiningTable.updateOne(
    { _id: tableId, status: { $nin: ['inactive', 'cleaning'] } },
    { $set: { status: activeSession ? 'occupied' : upcoming ? 'reserved' : 'available' } }
  );
}


router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    reservedAt: z.coerce.date(),
    guestCount: z.coerce.number().int().min(1).max(50),
    phone: z.string().trim().min(8).max(20),
    areaPreference: z.string().trim().max(80).default(''),
    note: z.string().trim().max(300).default('')
  }).parse(req.body);
  if (body.reservedAt.getTime() < Date.now() + 30 * 60 * 1000) throw new AppError(400, 'Vui lòng đặt bàn trước ít nhất 30 phút');
  const reservation = await Reservation.create({
    reservationCode: `RS${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 3).toUpperCase()}`,
    customer: req.user._id, customerName: req.user.fullName, phone: body.phone,
    reservedAt: body.reservedAt, guestCount: body.guestCount,
    areaPreference: body.areaPreference, note: body.note,
    statusHistory: [{ status: 'pending', changedBy: req.user._id }]
  });
  await notifyRoles(['admin', 'staff'], {
    type: 'reservation', title: 'Có yêu cầu đặt bàn mới',
    message: `${req.user.fullName} đặt bàn cho ${body.guestCount} khách`, link: '/operations?tab=reservations'
  });
  res.status(201).json({ reservation });
}));

router.get('/mine', asyncHandler(async (req, res) => {
  const reservations = await Reservation.find({ customer: req.user._id }).populate('table').sort({ reservedAt: -1 }).lean();
  res.json({ reservations });
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const reservation = await Reservation.findOne({ _id: req.params.id, customer: req.user._id });
  if (!reservation) throw new AppError(404, 'Không tìm thấy yêu cầu đặt bàn');
  if (!['pending', 'confirmed'].includes(reservation.status)) throw new AppError(409, 'Không thể hủy đặt bàn ở trạng thái hiện tại');
  reservation.status = 'cancelled';
  reservation.statusHistory.push({ status: 'cancelled', changedBy: req.user._id });
  await reservation.save();
  await refreshTableStatus(reservation.table);
  res.json({ reservation });
}));

router.get('/', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const filter = req.query.status && req.query.status !== 'all' ? { status: req.query.status } : {};
  const reservations = await Reservation.find(filter).populate('customer', 'fullName phone email').populate('table').sort({ reservedAt: 1 }).limit(200).lean();
  res.json({ reservations });
}));

router.patch('/:id/status', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no-show']),
    tableId: z.string().optional()
  }).parse(req.body);
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) throw new AppError(404, 'Không tìm thấy đặt bàn');
  if (['cancelled', 'completed', 'no-show'].includes(reservation.status)) {
    throw new AppError(409, 'Lịch đặt đã kết thúc');
  }
  if (body.status === 'seated') {
    throw new AppError(409, 'Hãy nhận bàn đặt trực tiếp tại Sơ đồ bàn & gọi món để tạo phiên phục vụ');
  }
  if (reservation.status === 'seated') {
    throw new AppError(409, 'Bàn đã được nhận, hãy kết thúc phiên từ sơ đồ bàn và thu ngân');
  }
  if (body.status === 'completed') {
    throw new AppError(409, 'Chỉ hoàn tất lịch đặt sau khi đã nhận và trả bàn từ phiên phục vụ');
  }
  const oldTableId = reservation.table ? String(reservation.table) : null;
  if (body.tableId) {
    if (!/^[0-9a-fA-F]{24}$/.test(body.tableId)) throw new AppError(400, 'Mã bàn không hợp lệ');
    const table = await DiningTable.findById(body.tableId);
    if (!table || table.status === 'inactive' || table.capacity < reservation.guestCount) {
      throw new AppError(400, 'Bàn không phù hợp');
    }
    if (body.status === 'confirmed') {
      const overlap = await Reservation.exists({
        _id: { $ne: reservation._id }, table: table._id,
        status: { $in: ['confirmed', 'seated'] },
        reservedAt: {
          $gte: new Date(reservation.reservedAt.getTime() - 30 * 60 * 1000),
          $lte: new Date(reservation.reservedAt.getTime() + 30 * 60 * 1000)
        }
      });
      if (overlap) throw new AppError(409, 'Bàn đã có lịch đặt trùng khung giờ này');
    }
    reservation.table = table._id;
  }
  if (body.status === 'confirmed' && !reservation.table) {
    throw new AppError(400, 'Cần chọn bàn trước khi xác nhận đặt bàn');
  }
  reservation.status = body.status;
  reservation.statusHistory.push({ status: body.status, changedBy: req.user._id });
  await reservation.save();
  await refreshTableStatus(reservation.table);
  if (oldTableId && oldTableId !== String(reservation.table)) await refreshTableStatus(oldTableId);
  await notifyUser(reservation.customer, {
    type: 'reservation', title: 'Cập nhật đặt bàn',
    message: 'Yêu cầu ' + reservation.reservationCode + ' đã chuyển sang trạng thái ' + body.status,
    link: '/reservations'
  });
  res.json({ reservation: await reservation.populate('table') });
}));

export default router;

