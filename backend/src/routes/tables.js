import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { TableSession } from '../models/TableSession.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { status: { $ne: 'inactive' } };
  const tables = await DiningTable.find(filter).sort({ area: 1, name: 1 }).lean();
  res.json({ tables });
}));

const tableSchema = z.object({
  name: z.string().trim().min(1).max(30),
  area: z.string().trim().min(1).max(80),
  capacity: z.coerce.number().int().min(1).max(50),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning', 'inactive']).default('available'),
  description: z.string().trim().max(300).default('')
});

function parseTablePatch(input) {
  const parsed = tableSchema.partial().parse(input);
  return Object.fromEntries(Object.keys(input).filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]]));
}

router.post('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const table = await DiningTable.create(tableSchema.parse(req.body));
  res.status(201).json({ table });
}));

router.put('/:id', requireAuth, requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const changes = parseTablePatch(req.body);
  if (changes.status) {
    if (req.user.role !== 'admin') throw new AppError(403, 'Đổi trạng thái bàn cần được thực hiện qua quy trình nhận hoặc trả bàn');
    if (await TableSession.exists({ table: req.params.id, status: 'active' })) {
      throw new AppError(409, 'Bàn đang có phiên phục vụ, không thể đổi trạng thái thủ công');
    }
  }
  const table = await DiningTable.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!table) throw new AppError(404, 'Không tìm thấy bàn');
  res.json({ table });
}));

router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  if (await TableSession.exists({ table: req.params.id, status: 'active' })) {
    throw new AppError(409, 'Không thể ngừng sử dụng bàn đang có khách');
  }
  const table = await DiningTable.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
  if (!table) throw new AppError(404, 'Không tìm thấy bàn');
  res.json({ table, message: 'Đã ngừng sử dụng bàn' });
}));

export default router;

