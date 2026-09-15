// backend/src/models/AffiliateWithdrawal.js
import mongoose from 'mongoose';

const affiliateWithdrawalSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['bank', 'upi', 'paypal', 'razorpay'],
    required: true,
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  transactionId: {
    type: String,
  },
  notes: {
    type: String,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  processedAt: Date,
  completedAt: Date,
   metadata: {
    ip: String,
    userAgent: String,
    location: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

affiliateWithdrawalSchema.index({ affiliate: 1, createdAt: -1 });
affiliateWithdrawalSchema.index({ user: 1, createdAt: -1 });
affiliateWithdrawalSchema.index({ createdAt: -1 });


// Pre-save middleware
affiliateWithdrawalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual field for formatted amount
affiliateWithdrawalSchema.virtual('formattedAmount').get(function() {
  return `₹${this.amount.toFixed(2)}`;
});

// Virtual field for status badge
affiliateWithdrawalSchema.virtual('statusBadge').get(function() {
  const badges = {
    pending: { color: 'yellow', icon: '⏳', label: 'Pending' },
    approved: { color: 'blue', icon: '✅', label: 'Approved' },
    processing: { color: 'purple', icon: '🔄', label: 'Processing' },
    completed: { color: 'green', icon: '🎉', label: 'Completed' },
    failed: { color: 'red', icon: '❌', label: 'Failed' },
    cancelled: { color: 'gray', icon: '🚫', label: 'Cancelled' },
  };
  return badges[this.status] || badges.pending;
});


export default mongoose.model('AffiliateWithdrawal', affiliateWithdrawalSchema);