// backend/src/controllers/adminWithdrawalController.js
import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
import Affiliate from '../models/Affiliate.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// // backend/src/controllers/adminController.js
// import User from '../models/User.js';
// import Affiliate from '../models/Affiliate.js';
 import AffiliateReferral from '../models/AffiliateReferral.js';
// import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
 import Invoice from '../models/Invoice.js';
 import Subscription from '../models/Subscription.js';
//import Notification from '../models/Notification.js';


// // backend/src/controllers/adminWithdrawalController.js
// import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
// import Affiliate from '../models/Affiliate.js';
// import User from '../models/User.js';
// import Notification from '../models/Notification.js';

// @desc    Admin - Get all withdrawal requests
// @route   GET /api/admin/withdrawals
// backend/src/controllers/adminWithdrawalController.js

// @desc    Admin - Get all withdrawal requests
export const adminGetWithdrawals = async (req, res) => {
  try {
    // console.log('📝 ===== ADMIN GET WITHDRAWALS =====');
    // console.log('📝 Query params:', req.query);
    // console.log('📝 User:', req.user?.email, 'Role:', req.user?.role);

    const { 
      status, 
      page = 1, 
      limit = 20,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (status && status !== '' && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { 'paymentDetails.userName': { $regex: search, $options: 'i' } },
        { 'paymentDetails.userEmail': { $regex: search, $options: 'i' } },
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    //console.log('📝 Query:', JSON.stringify(query));

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    // ✅ Get all withdrawals without any filter
    const allWithdrawals = await AffiliateWithdrawal.find({});
    //console.log(`📝 Total withdrawals in DB: ${allWithdrawals.length}`);
    
    if (allWithdrawals.length > 0) {
    //  console.log('📝 First withdrawal:', allWithdrawals[0]);
    }

    // Get withdrawals with filters
    const withdrawals = await AffiliateWithdrawal.find(query)
      .populate('user', 'name email phone')
      .populate('affiliate', 'affiliateCode')
      .populate('processedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await AffiliateWithdrawal.countDocuments(query);

    //console.log(`✅ Found ${withdrawals.length} withdrawals (total: ${total})`);

    // Get summary stats
    const stats = await AffiliateWithdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Get total pending amount
    const pendingTotal = await AffiliateWithdrawal.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total withdrawn
    const totalWithdrawn = await AffiliateWithdrawal.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        stats: {
          breakdown: stats,
          pendingCount: stats.find(s => s._id === 'pending')?.count || 0,
          pendingTotal: pendingTotal[0]?.total || 0,
          totalRequests: await AffiliateWithdrawal.countDocuments(),
          totalWithdrawn: totalWithdrawn[0]?.total || 0,
        },
        pagination: {
          page: Number(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
   // console.error('❌ Admin get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get withdrawals',
    });
  }
};

// @desc    Admin - Get withdrawal details
// @route   GET /api/admin/withdrawals/:id
export const adminGetWithdrawalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const withdrawal = await AffiliateWithdrawal.findById(id)
      .populate('user', 'name email phone')
      .populate('affiliate', 'affiliateCode totalEarnings')
      .populate('processedBy', 'name email');

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
   // console.error('Admin get withdrawal details error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Admin - Update withdrawal status
// @route   PUT /api/admin/withdrawals/:id
export const adminUpdateWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, notes } = req.body;
    const adminId = req.user?._id || req.user?.id;

    const withdrawal = await AffiliateWithdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    const previousStatus = withdrawal.status;
    
    // Update status
    withdrawal.status = status;
    if (transactionId) withdrawal.transactionId = transactionId;
    if (notes) withdrawal.notes = notes;
    withdrawal.processedBy = adminId;

    if (status === 'processing') {
      withdrawal.processedAt = new Date();
    }
    
    if (status === 'completed' || status === 'failed') {
      withdrawal.completedAt = new Date();
    }

    // If failed, refund the amount
    if (status === 'failed' && previousStatus !== 'failed') {
      const affiliate = await Affiliate.findById(withdrawal.affiliate);
      if (affiliate) {
        affiliate.totalEarnings += withdrawal.amount;
        affiliate.totalWithdrawn = (affiliate.totalWithdrawn || 0) - withdrawal.amount;
        await affiliate.save();
      }
    }

    await withdrawal.save();

    // ✅ Create notification for affiliate
    const admin = await User.findById(adminId);
    const user = await User.findById(withdrawal.user);

    if (user) {
      let notificationTitle = '';
      let notificationMessage = '';

      if (status === 'approved') {
        notificationTitle = `✅ Withdrawal Approved - ₹${withdrawal.amount}`;
        notificationMessage = `Your withdrawal request of ₹${withdrawal.amount} has been approved by ${admin?.name || 'Admin'}. It will be processed shortly.`;
      } else if (status === 'completed') {
        notificationTitle = `🎉 Withdrawal Completed - ₹${withdrawal.amount}`;
        notificationMessage = `₹${withdrawal.amount} has been successfully transferred to your account. Transaction ID: ${transactionId || 'N/A'}`;
      } else if (status === 'failed') {
        notificationTitle = `❌ Withdrawal Failed - ₹${withdrawal.amount}`;
        notificationMessage = `Your withdrawal request of ₹${withdrawal.amount} has failed. Amount has been refunded to your wallet. Reason: ${notes || 'Technical issue'}`;
      }

      if (notificationTitle) {
        await Notification.create({
          user: withdrawal.user,
          type: 'withdrawal_approved',
          title: notificationTitle,
          message: notificationMessage,
          priority: 'high',
          data: { 
            withdrawalId: withdrawal._id, 
            transactionId,
            status 
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
   // console.error('Admin update withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Admin - Bulk process withdrawals
// @route   POST /api/admin/withdrawals/bulk
export const adminBulkProcessWithdrawals = async (req, res) => {
  try {
    const { withdrawalIds, status, notes } = req.body;
    const adminId = req.user?._id || req.user?.id;

    if (!withdrawalIds || withdrawalIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No withdrawals selected',
      });
    }

    const results = [];
    for (const id of withdrawalIds) {
      try {
        const withdrawal = await AffiliateWithdrawal.findById(id);
        if (withdrawal && withdrawal.status === 'pending') {
          withdrawal.status = status || 'approved';
          withdrawal.processedBy = adminId;
          if (notes) withdrawal.notes = notes;
          await withdrawal.save();
          results.push({ id: withdrawal._id, status: 'success' });
        }
      } catch (error) {
        results.push({ id, status: 'failed', error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        processed: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        details: results,
      },
    });
  } catch (error) {
   // console.error('Bulk process error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};







// ==================== DASHBOARD STATS ====================

// @desc    Get admin dashboard stats with pending count
// @route   GET /api/admin/stats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalInvoices, totalRevenue, activeSubscriptions, totalCompanies] = await Promise.all([
      User.countDocuments(),
      Invoice.countDocuments(),
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      User.countDocuments({ 'subscription.status': 'active' }),
      Affiliate.countDocuments(),
    ]);

    // ✅ Get pending withdrawal count for sidebar badge
    const pendingWithdrawals = await AffiliateWithdrawal.countDocuments({ status: 'pending' });

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt subscription.plan isActive');

    // Get recent invoices
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email');

    // Get subscription distribution
    const subscriptionDistribution = await User.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalInvoices,
        totalRevenue: totalRevenue[0]?.total || 0,
        activeSubscriptions,
        totalCompanies,
        pendingWithdrawals, // ✅ For sidebar badge
        recentUsers,
        recentInvoices,
        subscriptionDistribution,
      },
    });
  } catch (error) {
   // console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== USER MANAGEMENT (COMPLETE) ====================

// @desc    Get all users with complete details
// @route   GET /api/admin/users
export const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      subscription,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) query.role = role;
    if (subscription) query['subscription.plan'] = subscription;
    if (status !== undefined && status !== '') {
      query.isActive = status === 'true';
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .select('-password'),
      User.countDocuments(query),
    ]);

    // Get additional stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const [invoiceCount, totalRevenue, referralCount, affiliateEarnings] = await Promise.all([
        Invoice.countDocuments({ user: user._id }),
        Invoice.aggregate([
          { $match: { user: user._id } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        AffiliateReferral.countDocuments({ referredUser: user._id }),
        Affiliate.findOne({ user: user._id }).select('totalEarnings'),
      ]);

      return {
        ...user.toObject(),
        stats: {
          invoiceCount,
          totalRevenue: totalRevenue[0]?.total || 0,
          referralCount,
          affiliateEarnings: affiliateEarnings?.totalEarnings || 0,
        }
      };
    }));

    res.status(200).json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
   // console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single user with ALL details (Super Admin only)
// @route   GET /api/admin/users/:id
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is super admin
    const isSuperAdmin = req.user?.role === 'super_admin';

    // Get user with password only if super admin
    let userQuery = User.findById(id);
    if (isSuperAdmin) {
      userQuery = userQuery.select('+password');
    }
    
    const user = await userQuery;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all user data
    const [
      invoices,
      subscriptions,
      affiliate,
      referrals,
      withdrawals,
      notifications,
    ] = await Promise.all([
      Invoice.find({ user: id }).sort({ createdAt: -1 }),
      Subscription.find({ user: id }).sort({ createdAt: -1 }),
      Affiliate.findOne({ user: id }),
      AffiliateReferral.find({ 
        $or: [
          { referredUser: id },
          { affiliate: affiliate?._id }
        ]
      }).populate('referredUser', 'name email'),
      AffiliateWithdrawal.find({ user: id }).sort({ createdAt: -1 }),
      Notification.find({ user: id }).sort({ createdAt: -1 }).limit(20),
    ]);

    // Calculate commission stats
    let commissionStats = {
      totalEarnings: 0,
      totalReferrals: 0,
      totalConversions: 0,
      pendingWithdrawals: 0,
      totalWithdrawn: 0,
    };

    if (affiliate) {
      const withdrawals = await AffiliateWithdrawal.find({ affiliate: affiliate._id });
      commissionStats = {
        totalEarnings: affiliate.totalEarnings || 0,
        totalReferrals: affiliate.totalReferrals || 0,
        totalConversions: affiliate.totalConversions || 0,
        pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0),
        totalWithdrawn: withdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + w.amount, 0),
      };
    }

    // Get invoice stats
    const invoiceStats = {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'paid').length,
      draft: invoices.filter(i => i.status === 'draft').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      totalRevenue: invoices.reduce((sum, i) => sum + i.total, 0),
    };

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          password: isSuperAdmin ? user.password : undefined, // Only super admin can see
        },
        stats: {
          invoices: invoiceStats,
          subscriptions: {
            current: user.subscription,
            history: subscriptions,
          },
          affiliate: affiliate ? {
            ...affiliate.toObject(),
            commissionStats,
          } : null,
          referrals,
          withdrawals,
          notifications,
        },
      },
    });
  } catch (error) {
   // console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user (Admin/Super Admin)
// @route   PUT /api/admin/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, subscription } = req.body;
    const isSuperAdmin = req.user?.role === 'super_admin';

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only super admin can change role to super_admin
    if (role === 'super_admin' && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can assign super_admin role',
      });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role && isSuperAdmin) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (subscription) {
      user.subscription.plan = subscription.plan || user.subscription.plan;
      user.subscription.status = subscription.status || user.subscription.status;
      if (subscription.endDate) user.subscription.endDate = subscription.endDate;
    }

    user.updatedAt = Date.now();
    await user.save();

    // Create notification for user
    await Notification.create({
      user: user._id,
      type: 'system_notification',
      title: 'Account Updated by Admin',
      message: `Your account has been updated by ${req.user.name}`,
      priority: 'medium',
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
   // console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete user (Super Admin only)
// @route   DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can delete users',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Don't allow deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    // Delete all user data
    await Promise.all([
      Invoice.deleteMany({ user: id }),
      Subscription.deleteMany({ user: id }),
      Affiliate.deleteOne({ user: id }),
      AffiliateReferral.deleteMany({ referredUser: id }),
      AffiliateWithdrawal.deleteMany({ user: id }),
      Notification.deleteMany({ user: id }),
      User.deleteOne({ _id: id }),
    ]);

    res.status(200).json({
      success: true,
      message: 'User and all associated data deleted successfully',
    });
  } catch (error) {
    //console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== AFFILIATE COMMISSION CALCULATION ====================

// @desc    Get affiliate commission details for a user
// @route   GET /api/admin/users/:id/commission
export const getUserCommission = async (req, res) => {
  try {
    const { id } = req.params;

    const affiliate = await Affiliate.findOne({ user: id });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'User is not an affiliate',
      });
    }

    const referrals = await AffiliateReferral.find({ affiliate: affiliate._id })
      .populate('referredUser', 'name email')
      .sort({ createdAt: -1 });

    // Calculate commission breakdown
    const breakdown = {
      totalCommission: affiliate.totalEarnings || 0,
      totalReferrals: affiliate.totalReferrals || 0,
      totalConversions: affiliate.totalConversions || 0,
      totalClicks: affiliate.totalClicks || 0,
      monthlyEarnings: affiliate.monthlyEarnings || [],
      conversionRate: affiliate.totalClicks > 0 
        ? ((affiliate.totalConversions / affiliate.totalClicks) * 100).toFixed(2)
        : 0,
    };

    // Get per referral commission
    const referralDetails = referrals.map(r => ({
      user: r.referredUser,
      status: r.status,
      commission: r.commission || 0,
      plan: r.subscriptionPlan,
      amount: r.subscriptionAmount,
      date: r.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        affiliate,
        breakdown,
        referrals: referralDetails,
      },
    });
  } catch (error) {
   // console.error('Get user commission error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};