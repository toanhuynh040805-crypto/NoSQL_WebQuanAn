import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  receiptCode: { type: String, required: true, unique: true },
  scopeType: { type: String, enum: ['session', 'order'], required: true },
  scopeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: ['cash', 'bank-transfer'], required: true },
  cashReceived: { type: Number, min: 0 },
  changeAmount: { type: Number, default: 0, min: 0 },
  transferContent: { type: String, trim: true },
  bankTransactionRef: { type: String, trim: true },
  bankVerifiedManually: { type: Boolean, default: false },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verifiedAt: { type: Date, required: true },
  requestId: { type: String, required: true, unique: true }
}, { timestamps: true });
schema.index({ scopeType: 1, scopeId: 1 }, { unique: true });
schema.index({ bankTransactionRef: 1 }, {
  unique: true, partialFilterExpression: { bankTransactionRef: { $type: 'string' } }
});
schema.index({ confirmedBy: 1, createdAt: -1 });
export const PaymentReceipt = mongoose.model('PaymentReceipt', schema);
