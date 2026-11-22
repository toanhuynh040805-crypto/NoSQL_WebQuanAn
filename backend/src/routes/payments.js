import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { redis } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { TableSession } from '../models/TableSession.js';
import { PaymentReceipt } from '../models/PaymentReceipt.js';
import { User } from '../models/User.js';
import { transferInstructions } from '../services/paymentBank.js';
import { notifyUser, notifyRoles } from '../services/notifications.js';
import { rewardPaidOrders } from '../services/loyalty.js';
import { withResourceLock } from '../services/resourceLock.js';
import { refreshOrderTable } from '../services/tableState.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);
const cashier = requireRole('cashier', 'admin');
const validId = value => {
  if (!isValidObjectId(value)) throw new AppError(400, 'Mã hóa đơn không hợp lệ');
  return value;
};

async function readBill(scope, id, user) {
  const scopeId = validId(id);
  if (scope === 'session') {
    if (!['admin', 'cashier', 'staff', 'customer'].includes(user.role)) throw new AppError(403, 'Không có quyền xem hóa đơn bàn');
    const session = await TableSession.findById(scopeId).lean();
    if (!session) throw new AppError(404, 'Không tìm thấy phiên bàn');
    if (user.role === 'customer' && String(session.customer) !== String(user._id)) throw new AppError(403, 'Không có quyền xem hóa đơn bàn này');
    const orders = await Order.find({ tableSession: session._id, status: { $ne: 'cancelled' } }).lean();
    const unpaid = orders.filter(order => order.paymentStatus !== 'paid');
    const lockOwner = await redis.get('table:lock:' + scopeId);
    const lockUser = lockOwner ? await User.findById(lockOwner).select('fullName').lean() : null;
    return {
      scopeType: 'session', scopeId, session, orders, unpaid,
      tableLock: lockOwner ? { ownerId: lockOwner, ownerName: lockUser?.fullName || 'Nhân viên', isMine: lockOwner === String(user._id) } : null,
      total: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      amount: unpaid.reduce((sum, order) => sum + order.totalAmount, 0),
      allServed: orders.every(order => order.status === 'completed')
    };
  }
  if (scope !== 'order') throw new AppError(404, 'Loại hóa đơn không hợp lệ');
  const order = await Order.findById(scopeId).lean();
  if (!order) throw new AppError(404, 'Không tìm thấy hóa đơn');
  if (order.tableSession) throw new AppError(409, 'Đơn tại bàn phải thanh toán theo toàn bộ phiên bàn');
  if (user.role === 'customer' && String(order.customer) !== String(user._id)) {
    throw new AppError(403, 'Không có quyền xem hóa đơn này');
  }
  if (!['customer', 'admin', 'cashier'].includes(user.role)) throw new AppError(403, 'Không có quyền xem hóa đơn');
  if (order.status === 'cancelled') throw new AppError(409, 'Đơn đã hủy, không thể thanh toán');
  return {
    scopeType: 'order', scopeId, order, orders: [order],
    unpaid: order.paymentStatus === 'paid' ? [] : [order],
    total: order.totalAmount, amount: order.paymentStatus === 'paid' ? 0 : order.totalAmount,
    allServed: true
  };
}

function makeQuote(bill, receipt = null) {
  return {
    scopeType: bill.scopeType,
    scopeId: bill.scopeId,
    total: bill.total,
    amount: receipt ? 0 : bill.amount,
    orderCount: bill.orders.length,
    allServed: bill.allServed,
    tableLock: bill.tableLock || null,
    transferReport: (bill.order || bill.session)?.bankTransferReport?.reportedAt ? (bill.order || bill.session).bankTransferReport : null,
    alreadyPaid: Boolean(receipt) || bill.amount === 0,
    receipt: receipt ? {
      receiptCode: receipt.receiptCode, method: receipt.method,
      amount: receipt.amount, verifiedAt: receipt.verifiedAt, changeAmount: receipt.changeAmount
    } : null,
    transfer: receipt ? null : transferInstructions(bill.scopeType, bill.scopeId, bill.amount)
  };
}

async function applyRecordedPayment(receipt, bill) {
  // Replayable after a network interruption; never creates a second financial receipt.
  await Order.updateMany(
    { _id: { $in: receipt.orders }, paymentStatus: { $ne: 'paid' } },
    { $set: {
      paymentStatus: 'paid', paymentMethod: receipt.method,
      paidAt: receipt.verifiedAt, paymentReceipt: receipt._id
    } }
  );
  await rewardPaidOrders(bill.orders.filter(order => receipt.orders.some(id => String(id) === String(order._id))));
  if (bill.scopeType === 'order') await refreshOrderTable(bill.order.tableNumber);
  if (bill.scopeType === 'session') {
    await TableSession.updateOne(
      { _id: bill.scopeId, paymentState: { $ne: 'paid' } },
      {
        $set: { paymentState: 'paid', paymentReceipt: receipt._id },
        $push: { activity: {
          action: 'payment', by: receipt.confirmedBy,
          detail: receipt.receiptCode + ' · ' + receipt.method
        } }
      }
    );
  }
}

router.get('/:scope/:id/quote', asyncHandler(async (req, res) => {
  const bill = await readBill(req.params.scope, req.params.id, req.user);
  const receipt = await PaymentReceipt.findOne({ scopeType: bill.scopeType, scopeId: bill.scopeId }).lean();
  res.json({ quote: makeQuote(bill, receipt) });
}));

// A customer report is an awaiting-verification signal, never financial confirmation.
router.post('/:scope/:id/report-transfer', requireRole('customer'), asyncHandler(async (req, res) => {
  const body = z.object({ expectedAmount: z.coerce.number().int().min(1), reference: z.string().trim().max(100).default('') }).parse(req.body);
  const id = validId(req.params.id);
  const scope = z.enum(['order', 'session']).parse(req.params.scope);
  await withResourceLock('payment:confirm:' + scope + ':' + id, async () => {
    const bill = await readBill(scope, id, req.user);
    if (!bill.amount || await PaymentReceipt.exists({ scopeType: scope, scopeId: id })) throw new AppError(409, 'Hóa đơn đã được xác nhận thanh toán');
    if (bill.amount !== body.expectedAmount) throw new AppError(409, 'Số tiền đã thay đổi. Vui lòng tải lại hóa đơn');
    const previouslyReported = Boolean((bill.order || bill.session).bankTransferReport?.reportedAt);
    const report = { reportedAt: new Date(), reference: body.reference, expectedAmount: bill.amount };
    if (scope === 'order') await Order.updateOne({ _id: id, paymentStatus: 'pending' }, { $set: { paymentMethod: 'bank-transfer', bankTransferReport: report } });
    else await TableSession.updateOne({ _id: id, paymentState: 'open' }, { $set: { bankTransferReport: report } });
    if (!previouslyReported) await notifyRoles(['admin', 'cashier'], {
      type: 'order', title: 'Khách báo đã chuyển khoản',
      message: `${bill.order ? 'Đơn ' + bill.order.orderCode : 'Bàn ' + bill.session.tableNumber}: ${bill.amount.toLocaleString('vi-VN')} đ. Vui lòng đối chiếu tài khoản ngân hàng.`,
      link: scope === 'order' ? '/operations?tab=orders' : '/staff/tables'
    }).catch(error => console.error('[Transfer notification]', error.message));
    res.json({ transferReport: report, paymentStatus: 'pending', message: 'Đã gửi thông báo. Đang chờ thu ngân kiểm tra nhận tiền' });
  });
}));

const confirmSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('cash'),
    expectedAmount: z.coerce.number().int().min(1),
    cashReceived: z.coerce.number().int().min(1),
    takeOverTableLock: z.boolean().default(false),
    requestId: z.string().uuid()
  }),
  z.object({
    method: z.literal('bank-transfer'),
    expectedAmount: z.coerce.number().int().min(1),
    bankVerifiedManually: z.literal(true),
    bankTransactionRef: z.string().trim().min(3).max(100).transform(value => value.toUpperCase()),
    takeOverTableLock: z.boolean().default(false),
    requestId: z.string().uuid()
  })
]);

router.post('/:scope/:id/confirm', cashier, asyncHandler(async (req, res) => {
  const body = confirmSchema.parse(req.body);
  const scope = req.params.scope;
  if (!['session', 'order'].includes(scope)) throw new AppError(404, 'Loại hóa đơn không hợp lệ');
  const scopeId = validId(req.params.id);
  const key = 'payment:confirm:' + scope + ':' + scopeId;
  const owner = randomUUID();
  if (!(await redis.set(key, owner, { NX: true, EX: 30 }))) {
    throw new AppError(423, 'Hóa đơn đang được thu ngân khác xử lý');
  }
  try {
    const bill = await readBill(scope, scopeId, req.user);
    const previous = await PaymentReceipt.findOne({ scopeType: scope, scopeId });
    if (previous) {
      await applyRecordedPayment(previous, bill);
      return res.json({ receipt: previous, duplicate: true });
    }
    if (bill.scopeType === 'session') {
      if (bill.session.status !== 'active' || bill.session.paymentState === 'paid') {
        throw new AppError(409, 'Phiên bàn không còn cho phép thanh toán');
      }
      if (!bill.orders.length) throw new AppError(409, 'Bàn chưa có món');
      if (!bill.allServed) throw new AppError(409, 'Vẫn còn món chưa được phục vụ xong');
      const tableLockOwner = await redis.get('table:lock:' + scopeId);
      if (tableLockOwner && tableLockOwner !== String(req.user._id)) {
        if (!body.takeOverTableLock) throw new AppError(423, 'Nhân viên phục vụ đang giữ bàn. Chọn tiếp nhận bàn để thu tiền hoặc yêu cầu phục vụ trả quyền');
        const taken = await redis.eval(
          'if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("SET", KEYS[1], ARGV[2], "EX", 300) return 1 else return 0 end',
          { keys: ['table:lock:' + scopeId], arguments: [tableLockOwner, String(req.user._id)] }
        );
        if (!taken) throw new AppError(409, 'Quyền thao tác bàn vừa thay đổi. Vui lòng tải lại');
        await TableSession.updateOne({ _id: scopeId }, { $push: { activity: { action: 'cashier-takeover', by: req.user._id, detail: 'Tiếp nhận từ nhân viên để xác nhận nhận tiền' } } });
      }
    }
    if (!Number.isSafeInteger(bill.amount) || bill.amount <= 0) {
      throw new AppError(409, 'Hóa đơn đã thanh toán hoặc không có tiền phải thu');
    }
    if (bill.amount !== body.expectedAmount) throw new AppError(409, 'Số tiền thay đổi, vui lòng tải lại hóa đơn và QR');
    if (body.method === 'cash' && body.cashReceived < bill.amount) {
      throw new AppError(400, 'Khách đưa tiền chưa đủ');
    }
    const transfer = body.method === 'bank-transfer'
      ? transferInstructions(scope, scopeId, bill.amount) : null;
    let receipt;
    try {
      receipt = await PaymentReceipt.create({
        receiptCode: 'PM-' + randomUUID().slice(0, 12).toUpperCase(),
        scopeType: scope, scopeId, orders: bill.unpaid.map(o => o._id),
        amount: bill.amount, method: body.method,
        ...(body.method === 'cash'
          ? { cashReceived: body.cashReceived, changeAmount: body.cashReceived - bill.amount }
          : { transferContent: transfer.content, bankTransactionRef: body.bankTransactionRef,
              bankVerifiedManually: true }),
        confirmedBy: req.user._id, verifiedAt: new Date(), requestId: body.requestId
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await PaymentReceipt.findOne({ scopeType: scope, scopeId });
      if (!existing) throw new AppError(409, 'Mã giao dịch ngân hàng đã được ghi nhận cho hóa đơn khác');
      receipt = existing;
    }
    await applyRecordedPayment(receipt, bill);
    if (bill.scopeType === 'order' && bill.order.customer) {
      await notifyUser(bill.order.customer, {
        type: 'order', title: 'Đã xác nhận thanh toán',
        message: 'Đơn ' + bill.order.orderCode + ' đã được thu ngân xác nhận nhận tiền',
        link: '/orders'
      }).catch(() => {});
    }
    res.status(201).json({ receipt, duplicate: false });
  } finally {
    await redis.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
      { keys: [key], arguments: [owner] }
    ).catch(error => console.error('[Payment lock release]', error.message));
  }
}));

export default router;
