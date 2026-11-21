import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { redis } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { TableSession } from '../models/TableSession.js';
import { PaymentReceipt } from '../models/PaymentReceipt.js';
import { transferInstructions } from '../services/paymentBank.js';
import { notifyUser } from '../services/notifications.js';
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
    if (!['admin', 'cashier', 'staff'].includes(user.role)) throw new AppError(403, 'Không có quyền xem hóa đơn bàn');
    const session = await TableSession.findById(scopeId).lean();
    if (!session) throw new AppError(404, 'Không tìm thấy phiên bàn');
    const orders = await Order.find({ tableSession: session._id, status: { $ne: 'cancelled' } }).lean();
    const unpaid = orders.filter(order => order.paymentStatus !== 'paid');
    return {
      scopeType: 'session', scopeId, session, orders, unpaid,
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

const confirmSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('cash'),
    expectedAmount: z.coerce.number().int().min(1),
    cashReceived: z.coerce.number().int().min(1),
    requestId: z.string().uuid()
  }),
  z.object({
    method: z.literal('bank-transfer'),
    expectedAmount: z.coerce.number().int().min(1),
    bankVerifiedManually: z.literal(true),
    bankTransactionRef: z.string().trim().min(5).max(100),
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
        throw new AppError(423, 'Nhân viên phục vụ đang giữ bàn, hãy trả quyền thao tác trước');
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
    );
  }
}));

export default router;
