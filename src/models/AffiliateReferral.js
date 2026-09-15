// backend/src/models/AffiliateReferral.js
import mongoose from 'mongoose';

const affiliateReferralSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
  },
  affiliateLink: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateLink',
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  ip: String,
  userAgent: String,
  referrer: String,
  status: {
    type: String,
    enum: ['clicked', 'registered', 'subscribed', 'cancelled'],
    default: 'clicked',
  },
  commission: {
    type: Number,
    default: 0,
  },
  totalCommissionPaid: {
    type: Number,
    default: 0,
  },
  subscriptionPlan: String,
  subscriptionAmount: Number,
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  lastCommissionDate: Date,
  commissionCount: {
    type: Number,
    default: 0,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  convertedAt: Date,
});

affiliateReferralSchema.index({ affiliate: 1, createdAt: -1 });
affiliateReferralSchema.index({ referredUser: 1 });

export default mongoose.model('AffiliateReferral', affiliateReferralSchema);