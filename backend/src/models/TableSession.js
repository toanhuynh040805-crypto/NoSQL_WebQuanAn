import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  action: { type: String, required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
  detail: { type: String, default: '' }
}, { _id: false });

const schema = new mongoose.Schema({
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable', required: true },
  tableNumber: { type: String, required: true },
  guestCount: { type: Number, required: true, min: 1, max: 50 },
  customerName: { type: String, trim: true, maxlength: 100, default: '' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: Date,
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  paymentState: { type: String, enum: ['open', 'paid'], default: 'open' },
  paymentReceipt: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentReceipt' },
  bankTransferReport: { reportedAt: Date, reference: String, expectedAmount: Number },
  activity: { type: [logSchema], default: [] }
}, { timestamps: true });

// One table must never have two active sessions, even under concurrent requests.
schema.index({ table: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
schema.index({ status: 1, openedAt: -1 });

export const TableSession = mongoose.model('TableSession', schema);
