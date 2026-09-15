// backend/src/models/Affiliate.js
import mongoose from 'mongoose';

const affiliateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  affiliateCode: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  commissionType: {
    type: String,
    enum: ['one_time', 'recurring'],
    default: 'one_time', // one_time = only first subscription, recurring = every month
  },
  commissionRate: {
    type: Number,
    default: 10, // 10% commission
  },
   totalWithdrawn: {  // ✅ NEW FIELD
    type: Number,
    default: 0,
  },
  totalEarnings: {
    type: Number,
    default: 0,
  },
  totalReferrals: {
    type: Number,
    default: 0,
  },
  totalClicks: {
    type: Number,
    default: 0,
  },
  totalConversions: {
    type: Number,
    default: 0,
  },
  monthlyEarnings: [{
    month: Number,
    year: Number,
    amount: Number,
  }],
  paymentEmail: {
    type: String,
  },
  paymentMethod: {
    type: String,
    enum: ['bank', 'paypal', 'razorpay'],
    default: 'razorpay',
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolder: String,
  },
  paypalEmail: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

affiliateSchema.pre('save', function(next) {
  if (!this.affiliateCode) {
    this.affiliateCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Affiliate', affiliateSchema);