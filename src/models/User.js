// backend/src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'admin',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'cancelled'],
      default: 'active', // Changed to active by default for testing
    },
    startDate: Date,
    endDate: Date,
    razorpaySubscriptionId: String,
    // Email limits based on plan
    limits: {
      monthly: {
        type: Number,
        default: 5, // Free plan default
      },
      used: {
        type: Number,
        default: 0,
      },
      resetDate: {
        type: Date,
        default: () => {
          const date = new Date();
          date.setMonth(date.getMonth() + 1);
          date.setDate(1);
          date.setHours(0, 0, 0, 0);
          return date;
        },
      },
    },
  },
  company: {
    name: String,
    address: String,
    phone: String,
    gst: String,
  },
  stats: {
    totalInvoices: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    lastActive: Date,
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

// Middleware to set limits based on plan
userSchema.pre('save', function(next) {
  if (this.isModified('subscription.plan')) {
    const planLimits = {
      free: 5,
      basic: 300,
      pro: 1000,
      enterprise: 2000,
    };
    this.subscription.limits.monthly = planLimits[this.subscription.plan] || 5;
  }
  
  // Reset used count if reset date has passed
  if (this.subscription.limits.resetDate && new Date() > this.subscription.limits.resetDate) {
    this.subscription.limits.used = 0;
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    this.subscription.limits.resetDate = date;
  }
  
  this.updatedAt = Date.now();
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.updatedAt = Date.now();
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user can send more emails
userSchema.methods.canSendEmail = async function() {
  // Check if reset date has passed
  const now = new Date();
  if (now > this.subscription.limits.resetDate) {
    this.subscription.limits.used = 0;
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    this.subscription.limits.resetDate = date;
    await this.save();
  }
  
  const limit = this.subscription.limits.monthly;
  const used = this.subscription.limits.used;
  return used < limit;
};

// Method to increment email count
userSchema.methods.incrementEmailCount = async function() {
  this.subscription.limits.used += 1;
  await this.save();
};

// Method to get remaining email count
userSchema.methods.getRemainingEmails = function() {
  const limit = this.subscription.limits.monthly;
  const used = this.subscription.limits.used;
  return Math.max(0, limit - used);
};

export default mongoose.model('User', userSchema);