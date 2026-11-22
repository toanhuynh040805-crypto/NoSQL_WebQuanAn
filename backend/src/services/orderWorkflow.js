import { AppError } from '../utils/errors.js';

const next = { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['completed'], completed: [], cancelled: [] };
const byRole = { kitchen: ['preparing', 'ready'], cashier: ['completed', 'cancelled'], staff: ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'], admin: ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'] };

export function validateOrderTransition(order, status, role) {
  if (!byRole[role]?.includes(status)) throw new AppError(403, 'Vai trò không được cập nhật trạng thái này');
  if (!next[order.status]?.includes(status)) throw new AppError(409, 'Không thể chuyển trạng thái này. Vui lòng thực hiện đúng thứ tự xác nhận → chế biến → sẵn sàng → hoàn thành');
  if (status === 'cancelled' && order.paymentStatus === 'paid') throw new AppError(409, 'Đơn đã thanh toán không thể hủy trực tiếp');
}
