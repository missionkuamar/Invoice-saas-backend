// backend/src/controllers/affiliateController.js
import Affiliate from '../models/Affiliate.js';
import AffiliateLink from '../models/AffiliateLink.js';
import AffiliateReferral from '../models/AffiliateReferral.js';
import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

// ==================== AFFILIATE PROGRAM ====================

// @desc    Join affiliate program
// @route   POST /api/affiliate/join
export const joinAffiliateProgram = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Check if already affiliate
    const existing = await Affiliate.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already an affiliate member',
      });
    }

    const affiliate = await Affiliate.create({
      user: userId,
      affiliateCode: 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      status: 'active',
      commissionRate: 10,
    });

    res.status(201).json({
      success: true,
      message: 'Joined affiliate program successfully',
      data: affiliate,
    });
  } catch (error) {
   // console.error('Join affiliate error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get affiliate dashboard
// @route   GET /api/affiliate/dashboard
export const getAffiliateDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        // message: 'Not an affiliate member',
      });
    }

    // Get stats
    const [links, referrals, monthlyEarnings] = await Promise.all([
      AffiliateLink.find({ affiliate: affiliate._id }),
      AffiliateReferral.find({ affiliate: affiliate._id }),
      AffiliateReferral.aggregate([
        { 
          $match: { 
            affiliate: affiliate._id,
            createdAt: { 
              $gte: new Date(new Date().setDate(1)) 
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$commission' } } }
      ])
    ]);

    const totalReferrals = await AffiliateReferral.countDocuments({ 
      affiliate: affiliate._id,
      status: 'converted'
    });

    res.status(200).json({
      success: true,
      data: {
        affiliate,
        stats: {
          totalClicks: affiliate.totalClicks || 0,
          totalReferrals: affiliate.totalReferrals || 0,
          totalConversions: affiliate.totalConversions || 0,
          totalEarnings: affiliate.totalEarnings || 0,
          monthlyEarnings: monthlyEarnings[0]?.total || 0,
          activeLinks: links.filter(l => l.status === 'active').length,
          conversionRate: affiliate.totalClicks > 0 
            ? ((affiliate.totalConversions / affiliate.totalClicks) * 100).toFixed(2)
            : 0,
        },
        recentReferrals: await AffiliateReferral.find({ affiliate: affiliate._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('referredUser', 'name email'),
        links,
      },
    });
  } catch (error) {
   // console.error('Affiliate dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== AFFILIATE LINKS ====================

// @desc    Create affiliate link
// @route   POST /api/affiliate/links
// backend/src/controllers/affiliateController.js

// @desc    Create affiliate link
// @route   POST /api/affiliate/links
export const createAffiliateLink = async (req, res) => {
  try {
    const { name, destination, slug } = req.body;
    const userId = req.user._id;

    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
       // message: 'Not an affiliate member',
      });
    }

    // Check if slug exists
    const existing = await AffiliateLink.findOne({ slug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Slug already taken. Please choose another.',
      });
    }

    const link = await AffiliateLink.create({
      affiliate: affiliate._id,
      name,
      destination: destination || '/',
      slug: slug || Math.random().toString(36).substring(2, 10),
      status: 'active',
    });

    // Generate full link URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const linkUrl = `${baseUrl}/r/${link.slug}?ref=${affiliate.affiliateCode}`;

    res.status(201).json({
      success: true,
      data: {
        ...link.toObject(),
        fullUrl: linkUrl,
      },
    });
  } catch (error) {
   // console.error('Create affiliate link error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// backend/src/controllers/affiliateController.js

// @desc    Track affiliate click and redirect
// @route   GET /r/:slug
export const trackAffiliateClick = async (req, res) => {
  try {
    const { slug } = req.params;
    const { ref } = req.query;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers.referer || 'direct';

   // console.log(`🔗 Affiliate click: /r/${slug} | ref: ${ref} | ip: ${ip}`);

    // Find the link
    const link = await AffiliateLink.findOne({ slug });
    if (!link) {
   //   console.log(`❌ Link not found: ${slug}`);
      return res.redirect('/');
    }

    // Find affiliate
    const affiliate = await Affiliate.findOne({ 
      _id: link.affiliate,
      affiliateCode: ref 
    });

    if (!affiliate) {
     // console.log(`❌ Affiliate not found: ${ref}`);
      return res.redirect('/');
    }

   // console.log(`✅ Affiliate found: ${affiliate.affiliateCode} (${affiliate.user})`);

    // Track click
    link.clicks += 1;
    await link.save();

    affiliate.totalClicks += 1;
    await affiliate.save();

    // Create referral record
    const referral = await AffiliateReferral.create({
      affiliate: affiliate._id,
      affiliateLink: link._id,
      ip: ip,
      userAgent: userAgent,
      referrer: referrer,
      status: 'clicked',
    });

   // console.log(`✅ Referral created: ${referral._id}`);

    // Store in session for later
    req.session.affiliateReferral = {
      referralId: referral._id,
      affiliateId: affiliate._id,
      linkId: link._id,
    };

    // Save session before redirect
    await new Promise((resolve) => {
      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        resolve();
      });
    });

    // Redirect to destination
    const destination = link.destination || '/';
  //  console.log(`🔄 Redirecting to: ${destination}`);
    
    // If destination is a full URL, redirect there
    if (destination.startsWith('http://') || destination.startsWith('https://')) {
      return res.redirect(destination);
    }
    
    // Otherwise, redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}${destination}`);
  } catch (error) {
   // console.error('Track affiliate click error:', error);
    // Redirect to home on error
    res.redirect('/');
  }
};

// @desc    Get all affiliate links
// @route   GET /api/affiliate/links
export const getAffiliateLinks = async (req, res) => {
  try {
    const userId = req.user._id;
    const affiliate = await Affiliate.findOne({ user: userId });
    
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'Not an affiliate member',
      });
    }

    const links = await AffiliateLink.find({ affiliate: affiliate._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: links,
    });
  } catch (error) {
    //console.error('Get affiliate links error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update affiliate link
// @route   PUT /api/affiliate/links/:id
export const updateAffiliateLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, destination, status } = req.body;
    const userId = req.user._id;

    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'Not an affiliate member',
      });
    }

    const link = await AffiliateLink.findOne({ _id: id, affiliate: affiliate._id });
    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Link not found',
      });
    }

    if (name) link.name = name;
    if (destination) link.destination = destination;
    if (status) link.status = status;
    link.updatedAt = Date.now();

    await link.save();

    res.status(200).json({
      success: true,
      data: link,
    });
  } catch (error) {
    //console.error('Update affiliate link error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete affiliate link
// @route   DELETE /api/affiliate/links/:id
export const deleteAffiliateLink = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'Not an affiliate member',
      });
    }

    const link = await AffiliateLink.findOneAndDelete({ 
      _id: id, 
      affiliate: affiliate._id 
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Link not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Link deleted successfully',
    });
  } catch (error) {
  //  console.error('Delete affiliate link error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== TRACKING ====================



// @desc    Track affiliate conversion (called when user subscribes)
// @route   POST /api/affiliate/track-conversion
export const trackAffiliateConversion = async (req, res) => {
  try {
    const { plan, amount } = req.body;
    const userId = req.user._id;

    // Check if user came from affiliate link
    const referral = await AffiliateReferral.findOne({
      referredUser: userId,
      status: 'registered',
    }).sort({ createdAt: -1 });

    if (!referral) {
      return res.status(200).json({ success: true, message: 'No affiliate referral found' });
    }

    // Update referral
    referral.status = 'converted';
    referral.subscriptionPlan = plan;
    referral.subscriptionAmount = amount;
    referral.convertedAt = new Date();
    await referral.save();

    // Update affiliate stats
    const affiliate = await Affiliate.findById(referral.affiliate);
    if (affiliate) {
      affiliate.totalReferrals += 1;
      affiliate.totalConversions += 1;
      
      const commission = (amount * affiliate.commissionRate) / 100;
      affiliate.totalEarnings += commission;
      referral.commission = commission;
      await referral.save();
      await affiliate.save();
    }

    res.status(200).json({
      success: true,
      message: 'Conversion tracked successfully',
    });
  } catch (error) {
   // console.error('Track conversion error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== EARNINGS & WITHDRAWAL ====================

// @desc    Get earnings summary
// @route   GET /api/affiliate/earnings
export const getEarnings = async (req, res) => {
  try {
    const userId = req.user._id;
    const affiliate = await Affiliate.findOne({ user: userId });
    
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'Not an affiliate member',
      });
    }

    // Get earnings by month
    const monthlyEarnings = await AffiliateReferral.aggregate([
      {
        $match: {
          affiliate: affiliate._id,
          status: 'converted',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$convertedAt' },
            month: { $month: '$convertedAt' },
          },
          total: { $sum: '$commission' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings: affiliate.totalEarnings,
        totalReferrals: affiliate.totalReferrals,
        totalConversions: affiliate.totalConversions,
        monthlyEarnings,
        commissionRate: affiliate.commissionRate,
      },
    });
  } catch (error) {
    //console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};





// backend/src/controllers/affiliateController.js - Add debug endpoint

// @desc    Debug - Check affiliate referral for a user
// @route   GET /api/affiliate/debug/:userId
export const debugAffiliateReferral = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const referrals = await AffiliateReferral.find({ referredUser: userId })
      .populate('affiliate', 'affiliateCode name email')
      .sort({ createdAt: -1 });

    const affiliate = await Affiliate.findOne({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        userId,
        isAffiliate: !!affiliate,
        affiliate: affiliate,
        referrals: referrals,
        count: referrals.length,
      },
    });
  } catch (error) {
   // console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};











// backend/src/controllers/affiliateController.js - Add debug endpoints

// @desc    Debug - Check all referrals
// @route   GET /api/affiliate/debug/all
export const debugAllReferrals = async (req, res) => {
  try {
    const referrals = await AffiliateReferral.find({})
      .populate('affiliate', 'affiliateCode user')
      .populate('referredUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: referrals,
    });
  } catch (error) {
   // console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Debug - Check affiliate by code
// @route   GET /api/affiliate/debug/code/:code
export const debugAffiliateByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const affiliate = await Affiliate.findOne({ affiliateCode: code })
      .populate('user', 'name email');

    const referrals = await AffiliateReferral.find({ affiliate: affiliate?._id })
      .populate('referredUser', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        affiliate,
        referrals,
        totalReferrals: referrals.length,
        totalEarnings: affiliate?.totalEarnings || 0,
      },
    });
  } catch (error) {
   // console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};










// backend/src/controllers/affiliateController.js
// import Affiliate from '../models/Affiliate.js';
// import User from '../models/User.js';
// import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
// import Notification from '../models/Notification.js';

/**
 * @desc    Request a withdrawal
 * @route   POST /api/affiliate/withdrawals
 * @access  Private (Affiliate only)
 */
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body;
    const userId = req.user._id;

   // console.log('Withdrawal Request:', { amount, paymentMethod, userId });

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid withdrawal amount',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Please select a payment method',
      });
    }

    // Check minimum withdrawal amount
    const MIN_WITHDRAWAL = process.env.MIN_WITHDRAWAL || 100;
    if (amount < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`,
      });
    }

    // Check maximum withdrawal amount (optional)
    const MAX_WITHDRAWAL = process.env.MAX_WITHDRAWAL || 100000;
    if (amount > MAX_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount is ₹${MAX_WITHDRAWAL}`,
      });
    }

    // Find affiliate
    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'You are not an affiliate member',
      });
    }

    // Check if affiliate is active
    if (affiliate.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Your affiliate account is ${affiliate.status}. Please contact support.`,
      });
    }

    // Check earnings
    if (amount > affiliate.totalEarnings) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient earnings',
        data: {
          available: affiliate.totalEarnings,
          requested: amount,
          shortfall: amount - affiliate.totalEarnings,
        },
      });
    }

    // Check for pending withdrawal requests
    const pendingWithdrawal = await AffiliateWithdrawal.findOne({
      affiliate: affiliate._id,
      status: { $in: ['pending', 'approved', 'processing'] },
    });

    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for it to be processed.',
        data: {
          pendingId: pendingWithdrawal._id,
          pendingAmount: pendingWithdrawal.amount,
          pendingStatus: pendingWithdrawal.status,
        },
      });
    }

    // Get user for payment details
    const user = await User.findById(userId);

    // Prepare payment details
    let finalPaymentDetails = { ...paymentDetails };
    
    // If no payment details provided, use affiliate's saved payment details
    if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
      if (paymentMethod === 'bank') {
        finalPaymentDetails = {
          accountNumber: affiliate.bankDetails?.accountNumber || '',
          ifscCode: affiliate.bankDetails?.ifscCode || '',
          bankName: affiliate.bankDetails?.bankName || '',
          accountHolder: affiliate.bankDetails?.accountHolder || user?.name || '',
        };
      } else if (paymentMethod === 'paypal') {
        finalPaymentDetails = {
          email: affiliate.paypalEmail || user?.email || '',
        };
      } else if (paymentMethod === 'upi') {
        finalPaymentDetails = {
          upiId: paymentDetails?.upiId || '',
        };
      }
    }

    // Validate payment details based on method
    if (paymentMethod === 'bank') {
      if (!finalPaymentDetails.accountNumber || !finalPaymentDetails.ifscCode) {
        return res.status(400).json({
          success: false,
          message: 'Please provide complete bank details (Account Number and IFSC Code)',
        });
      }
    } else if (paymentMethod === 'paypal') {
      if (!finalPaymentDetails.email) {
        return res.status(400).json({
          success: false,
          message: 'Please provide PayPal email address',
        });
      }
    } else if (paymentMethod === 'upi') {
      if (!finalPaymentDetails.upiId) {
        return res.status(400).json({
          success: false,
          message: 'Please provide UPI ID',
        });
      }
    }

    // Create withdrawal request
    const withdrawal = new AffiliateWithdrawal({
      affiliate: affiliate._id,
      user: userId,
      amount,
      paymentMethod,
      paymentDetails: finalPaymentDetails,
      status: 'pending',
      metadata: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        location: req.headers['x-forwarded-for'] || '',
      },
    });

    await withdrawal.save();

    // Deduct amount from affiliate earnings (but keep it in pending)
    affiliate.totalEarnings -= amount;
    affiliate.totalWithdrawn = (affiliate.totalWithdrawn || 0) + amount;
    await affiliate.save();

    // Create notification for admin
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        type: 'withdrawal_request',
        title: `💰 New Withdrawal Request - ₹${amount}`,
        message: `${user?.name || 'Affiliate'} has requested a withdrawal of ₹${amount} via ${paymentMethod}`,
        priority: 'high',
        data: {
          withdrawalId: withdrawal._id,
          affiliateId: affiliate._id,
          amount,
          userId: userId,
        },
      });
    }

    // Create notification for affiliate
    await Notification.create({
      user: userId,
      type: 'withdrawal_requested',
      title: `💰 Withdrawal Request Submitted - ₹${amount}`,
      message: `Your withdrawal request of ₹${amount} has been submitted successfully. It will be processed within 24-48 hours.`,
      priority: 'medium',
      data: {
        withdrawalId: withdrawal._id,
        amount,
        status: 'pending',
      },
    });

    // Populate response
    const populatedWithdrawal = await AffiliateWithdrawal.findById(withdrawal._id)
      .populate('user', 'name email phone')
      .populate('affiliate', 'affiliateCode totalEarnings totalWithdrawn');

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawal: populatedWithdrawal,
        summary: {
          requestedAmount: amount,
          remainingEarnings: affiliate.totalEarnings,
          totalWithdrawn: affiliate.totalWithdrawn,
          status: 'pending',
          estimatedProcessingTime: '24-48 hours',
        },
      },
    });

  } catch (error) {
   // console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process withdrawal request',
    });
  }
};

/**
 * @desc    Get affiliate withdrawal history
 * @route   GET /api/affiliate/withdrawals
 * @access  Private (Affiliate only)
 */
export const getWithdrawalHistory = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    const query = { user: userId };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [withdrawals, total] = await Promise.all([
      AffiliateWithdrawal.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AffiliateWithdrawal.countDocuments(query),
    ]);

    // Calculate summary stats
    const stats = await AffiliateWithdrawal.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const summary = {
      totalRequests: await AffiliateWithdrawal.countDocuments({ user: userId }),
      pending: stats.find(s => s._id === 'pending')?.count || 0,
      approved: stats.find(s => s._id === 'approved')?.count || 0,
      completed: stats.find(s => s._id === 'completed')?.count || 0,
      failed: stats.find(s => s._id === 'failed')?.count || 0,
      totalWithdrawn: stats.find(s => s._id === 'completed')?.totalAmount || 0,
      totalPending: stats.find(s => s._id === 'pending')?.totalAmount || 0,
    };

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        summary,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
   // console.error('Get withdrawal history error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get single withdrawal details
 * @route   GET /api/affiliate/withdrawals/:id
 * @access  Private (Affiliate only)
 */
export const getWithdrawalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const withdrawal = await AffiliateWithdrawal.findOne({
      _id: id,
      user: userId,
    })
      .populate('user', 'name email phone')
      .populate('affiliate', 'affiliateCode totalEarnings totalWithdrawn')
      .populate('processedBy', 'name email')
      .lean();

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    res.status(200).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
   /// console.error('Get withdrawal details error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Cancel pending withdrawal
 * @route   DELETE /api/affiliate/withdrawals/:id
 * @access  Private (Affiliate only)
 */
export const cancelWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const withdrawal = await AffiliateWithdrawal.findOne({
      _id: id,
      user: userId,
      status: 'pending',
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found or cannot be cancelled',
      });
    }

    // Refund amount to affiliate
    const affiliate = await Affiliate.findById(withdrawal.affiliate);
    if (affiliate) {
      affiliate.totalEarnings += withdrawal.amount;
      affiliate.totalWithdrawn = Math.max(0, (affiliate.totalWithdrawn || 0) - withdrawal.amount);
      await affiliate.save();
    }

    withdrawal.status = 'cancelled';
    withdrawal.notes = 'Cancelled by user';
    await withdrawal.save();

    await Notification.create({
      user: userId,
      type: 'withdrawal_cancelled',
      title: `🚫 Withdrawal Cancelled - ₹${withdrawal.amount}`,
      message: `Your withdrawal request of ₹${withdrawal.amount} has been cancelled. Amount has been refunded to your wallet.`,
      priority: 'medium',
      data: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal cancelled successfully',
      data: {
        withdrawal,
        refundedAmount: withdrawal.amount,
      },
    });
  } catch (error) {
   // console.error('Cancel withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};