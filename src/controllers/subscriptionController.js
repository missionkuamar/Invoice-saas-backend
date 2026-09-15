// backend/src/controllers/subscriptionController.js
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Affiliate from '../models/Affiliate.js';
import AffiliateReferral from '../models/AffiliateReferral.js';
import razorpay from '../config/razorpay.js';
import crypto from 'crypto';

// Subscription plans
export const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 499,
    features: ['50 invoices/month', 'Basic support', 'PDF export'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999,
    features: ['200 invoices/month', 'Priority support', 'Advanced analytics', 'Custom branding'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2999,
    features: ['Unlimited invoices', 'Dedicated support', 'API access', 'White-label'],
  },
];

// @desc    Get subscription plans
// @route   GET /api/subscriptions/plans
export const getPlans = (req, res) => {
  res.status(200).json({
    success: true,
    data: plans,
  });
};

// @desc    Create subscription order
// @route   POST /api/subscriptions/create-order
export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user?._id || req.user?.id;

    const selectedPlan = plans.find(p => p.id === plan);
    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected',
      });
    }

    // Check if user already has active subscription
    const user = await User.findById(userId);
    if (user && user.subscription?.status === 'active') {
      // Allow upgrade
    }

    const options = {
      amount: selectedPlan.price * 100, // Amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
      notes: {
        userId: userId.toString(),
        plan: selectedPlan.id,
        userEmail: user?.email || '',
      },
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
  //  console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order',
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, plan } = req.body;
    const userId = req.user?._id || req.user?.id;

  // console.log('📝 Verifying payment:', { orderId, paymentId, plan, userId });

    // Validate input
    if (!orderId || !paymentId || !signature || !plan) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const selectedPlan = plans.find(p => p.id === plan);
    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan',
      });
    }

    // Verify signature
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== signature) {
     // console.log('❌ Signature mismatch');
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

   // console.log(`✅ User found: ${user.email}`);

    // Check if user already has subscription
    const hasExistingSubscription = user.subscription?.status === 'active';

    // Activate subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // Update user subscription
    user.subscription = {
      plan: plan,
      status: 'active',
      startDate: startDate,
      endDate: endDate,
      razorpaySubscriptionId: paymentId,
    };
    await user.save();

    // Create subscription record
    const subscription = await Subscription.create({
      user: userId,
      plan,
      razorpaySubscriptionId: paymentId,
      status: 'active',
      startDate,
      endDate,
      amount: selectedPlan.price,
    });

   // console.log('✅ Subscription activated for user:', user.email);

    // ============ AFFILIATE COMMISSION TRACKING ============
    let affiliateData = {
      commission: 0,
      earned: false,
      message: 'No affiliate referral found',
    };

    try {
      // Find ALL referrals for this user
      const referrals = await AffiliateReferral.find({
        referredUser: userId,
      }).sort({ createdAt: -1 });

    //  console.log(`📝 Found ${referrals.length} referrals for user ${userId}`);

      if (referrals.length > 0) {
        // Use the first (most recent) referral
        const referral = referrals[0];
      //  console.log(`📝 Using referral: ${referral._id} (status: ${referral.status})`);

        const affiliate = await Affiliate.findById(referral.affiliate);
        
        if (affiliate && affiliate.status === 'active') {
       //   console.log(`✅ Affiliate found: ${affiliate.affiliateCode}`);
          
          // Calculate commission
          const commissionRate = affiliate.commissionRate || 10;
          const commissionAmount = (selectedPlan.price * commissionRate) / 100;

        //  console.log(`💰 Commission calculation: ${selectedPlan.price} * ${commissionRate}% = ${commissionAmount}`);

          // Update referral
          referral.status = 'subscribed';
          referral.subscriptionPlan = plan;
          referral.subscriptionAmount = selectedPlan.price;
          referral.subscriptionStartDate = startDate;
          referral.subscriptionEndDate = endDate;
          referral.commission += commissionAmount;
          referral.totalCommissionPaid += commissionAmount;
          referral.lastCommissionDate = new Date();
          referral.commissionCount += 1;
          referral.convertedAt = new Date();
          await referral.save();

          // Update affiliate stats
          affiliate.totalEarnings += commissionAmount;
          affiliate.totalConversions += 1;
          
          // Update monthly earnings
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          if (!affiliate.monthlyEarnings) affiliate.monthlyEarnings = [];
          
          const monthlyEarning = affiliate.monthlyEarnings.find(
            e => e.month === currentMonth && e.year === currentYear
          );
          if (monthlyEarning) {
            monthlyEarning.amount += commissionAmount;
          } else {
            affiliate.monthlyEarnings.push({
              month: currentMonth,
              year: currentYear,
              amount: commissionAmount,
            });
          }
          
          await affiliate.save();

          // Get referred user details
          const referredUser = await User.findById(referral.referredUser);

          affiliateData = {
            commission: commissionAmount,
            rate: commissionRate,
            earned: true,
            message: `Commission credited: ₹${commissionAmount}`,
            affiliateCode: affiliate.affiliateCode,
            referralName: referredUser?.name || user.name,
            referralEmail: referredUser?.email || user.email,
            referralStatus: referral.status,
            commissionCount: referral.commissionCount,
          };

        //  console.log(`✅ Affiliate ${affiliate.affiliateCode} earned ₹${commissionAmount} from ${user.name}`);
        } else {
          //console.log(`❌ Affiliate not found or inactive for referral: ${referral.affiliate}`);
        }
      } else {
      //  console.log(`ℹ️ No affiliate referral found for user: ${userId}`);
      }
    } catch (affiliateError) {
     // console.error('Affiliate commission error:', affiliateError);
      // Don't fail the subscription if affiliate tracking fails
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        plan: user.subscription.plan,
        endDate: user.subscription.endDate,
        subscriptionId: subscription._id,
        affiliate: affiliateData,
        // Add debug info
        debug: {
          hasAffiliate: affiliateData.earned,
          commission: affiliateData.commission,
        },
      },
    });
  } catch (error) {
   // console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed',
    });
  }
};

// @desc    Cancel subscription
// @route   POST /api/subscriptions/cancel
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId);
    
    if (!user || user.subscription.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel',
      });
    }

    user.subscription.status = 'cancelled';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error) {
    //console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current subscription
// @route   GET /api/subscriptions/current
export const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user.subscription || { plan: 'free', status: 'inactive' },
    });
  } catch (error) {
   // console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};