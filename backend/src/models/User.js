import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  customerNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  rewardedOrders: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }], select: false, default: [] },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin', 'staff', 'kitchen', 'cashier'], default: 'customer' },
  isActive: { type: Boolean, default: true },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  favoriteFoods: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Food' }]
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);

