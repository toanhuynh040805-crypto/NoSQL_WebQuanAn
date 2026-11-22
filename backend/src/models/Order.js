import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  note: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  source: { type: String, enum: ['customer', 'staff'], default: 'customer' },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  tableSession: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession' },
  clientRequestId: { type: String },
  items: { type: [orderItemSchema], validate: value => value.length > 0 },
  orderType: { type: String, enum: ['dine-in', 'takeaway'], default: 'dine-in' },
  tableNumber: { type: String, trim: true },
  note: { type: String, default: '' },
  subtotal: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  promotionCode: { type: String, trim: true, uppercase: true },
  paymentMethod: { type: String, enum: ['cash', 'bank-transfer', 'counter'], default: 'counter' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  paymentReceipt: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentReceipt' },
  paidAt: Date,
  bankTransferReport: {
    reportedAt: Date,
    reference: { type: String, trim: true, maxlength: 100 },
    expectedAmount: Number
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ tableSession: 1, createdAt: 1 });
orderSchema.index({ tableSession: 1, clientRequestId: 1 }, {
  unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } }
});
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1, paymentStatus: 1 });

export const Order = mongoose.model('Order', orderSchema);

