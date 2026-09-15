import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
// backend/src/controllers/adminController.js
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import Subscription from '../models/Subscription.js';
import Company from '../models/Company.js';
import mongoose from 'mongoose';
import Affiliate from '../models/Affiliate.js';
import Notification from '../models/Notification.js';
// ==================== DASHBOARD STATS ====================

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalInvoices, totalRevenue, activeSubscriptions, totalCompanies] = await Promise.all([
      User.countDocuments(),
      Invoice.countDocuments(),
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      User.countDocuments({ 'subscription.status': 'active' }),
      Company.countDocuments(),
    ]);

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt subscription.plan');

    // Get recent invoices
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email');

    // Get subscription distribution
    const subscriptionDistribution = await User.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
    ]);

    // Get monthly stats for chart
    const monthlyStats = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
        }
      },
      {
        $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalInvoices,
        totalRevenue: totalRevenue[0]?.total || 0,
        activeSubscriptions,
        totalCompanies,
        recentUsers,
        recentInvoices,
        subscriptionDistribution,
        monthlyStats,
      },
    });
  } catch (error) {
    //console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== USER MANAGEMENT ====================

// @desc    Get all users with filters
// @route   GET /api/admin/users
// backend/src/controllers/adminController.js

// @desc    Get all users with filters
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
      ];
    }

    if (role) query.role = role;
    if (subscription) query['subscription.plan'] = subscription;

    // Fix: Properly handle status filter
    if (status !== undefined && status !== '') {
      query.isActive = status === 'true' || status === true;
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

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
  //  console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single user details
// @route   GET /api/admin/users/:id
export const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get user's invoices
    const invoices = await Invoice.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20);

    // Get user's subscription history
    const subscriptionHistory = await Subscription.find({ user: req.params.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        user,
        invoices,
        subscriptionHistory,
        stats: {
          totalInvoices: await Invoice.countDocuments({ user: req.params.id }),
          totalRevenue: await Invoice.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(req.params.id) } },
            { $group: { _id: null, total: { $sum: '$total' } } },
          ]),
        },
      },
    });
  } catch (error) {
    //console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
export const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive, subscription } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (subscription) {
      user.subscription.plan = subscription.plan || user.subscription.plan;
      user.subscription.status = subscription.status || user.subscription.status;
      if (subscription.endDate) user.subscription.endDate = subscription.endDate;
    }

    user.updatedAt = Date.now();
    await user.save();

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

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete all user data
    await Promise.all([
      Invoice.deleteMany({ user: req.params.id }),
      Subscription.deleteMany({ user: req.params.id }),
      Company.deleteOne({ user: req.params.id }),
      User.deleteOne({ _id: req.params.id }),
    ]);

    res.status(200).json({
      success: true,
      message: 'User and all associated data deleted successfully',
    });
  } catch (error) {
  //  console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== INVOICE MANAGEMENT ====================

// @desc    Get all invoices (admin)
// @route   GET /api/admin/invoices
export const getInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      userId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'client.name': { $regex: search, $options: 'i' } },
        { 'client.email': { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.status = status;
    if (userId) query.user = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('user', 'name email'),
      Invoice.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    //console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete invoice (admin)
// @route   DELETE /api/admin/invoices/:id
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    await invoice.remove();

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
   // console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== SUBSCRIPTION MANAGEMENT ====================

// @desc    Get all subscriptions
// @route   GET /api/admin/subscriptions
export const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
   // console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update subscription
// @route   PUT /api/admin/subscriptions/:id
export const updateSubscription = async (req, res) => {
  try {
    const { plan, status, endDate } = req.body;
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    if (plan) subscription.plan = plan;
    if (status) subscription.status = status;
    if (endDate) subscription.endDate = new Date(endDate);

    await subscription.save();

    // Update user's subscription
    const user = await User.findById(subscription.user);
    if (user) {
      user.subscription.plan = subscription.plan;
      user.subscription.status = subscription.status;
      user.subscription.endDate = subscription.endDate;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
   // console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== SYSTEM SETTINGS ====================

// @desc    Get system settings
// @route   GET /api/admin/settings
export const getSystemSettings = async (req, res) => {
  try {
    // Get system stats
    const stats = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: false }),
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: 'paid' }),
      Subscription.countDocuments({ status: 'active' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: stats[0],
          inactive: stats[1],
        },
        invoices: {
          total: stats[2],
          paid: stats[3],
        },
        subscriptions: {
          active: stats[4],
        },
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        },
      },
    });
  } catch (error) {
   // console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
















// backend/src/controllers/adminWithdrawalController.js



/**
 * @desc    Get all withdrawal requests with filtering and pagination
 * @route   GET /api/admin/withdrawals
 * @access  Private/Admin
 */
export const getWithdrawals = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minAmount,
      maxAmount,
      paymentMethod,
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search filter (user name or email)
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);
      query.user = { $in: userIds };
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    // Execute queries in parallel
    const [withdrawals, total, statsData] = await Promise.all([
      AffiliateWithdrawal.find(query)
        .populate('user', 'name email phone profileImage')
        .populate('affiliate', 'affiliateCode totalEarnings totalReferrals')
        .populate('processedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AffiliateWithdrawal.countDocuments(query),
      AffiliateWithdrawal.aggregate([
        { $match: query },
        {
          $facet: {
            statusBreakdown: [
              { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
            ],
            pendingTotal: [
              { $match: { status: 'pending' } },
              { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
            ],
            completedTotal: [
              { $match: { status: 'completed' } },
              { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
            ],
            failedTotal: [
              { $match: { status: 'failed' } },
              { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
            ],
            approvedTotal: [
              { $match: { status: 'approved' } },
              { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
            ],
          }
        }
      ])
    ]);

    // Process stats
    const stats = statsData[0] || {};
    const statusBreakdown = stats.statusBreakdown || [];

    const pendingInfo = stats.pendingTotal?.[0] || { total: 0, count: 0 };
    const completedInfo = stats.completedTotal?.[0] || { total: 0, count: 0 };
    const failedInfo = stats.failedTotal?.[0] || { total: 0, count: 0 };
    const approvedInfo = stats.approvedTotal?.[0] || { total: 0, count: 0 };

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        stats: {
          breakdown: statusBreakdown,
          pendingCount: pendingInfo.count || 0,
          pendingTotal: pendingInfo.total || 0,
          completedCount: completedInfo.count || 0,
          completedTotal: completedInfo.total || 0,
          failedCount: failedInfo.count || 0,
          failedTotal: failedInfo.total || 0,
          approvedCount: approvedInfo.count || 0,
          approvedTotal: approvedInfo.total || 0,
          totalRequests: total,
          totalWithdrawn: completedInfo.total || 0,
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: Number(page) < Math.ceil(total / limit),
          hasPrev: Number(page) > 1,
        },
      },
    });
  } catch (error) {
    //console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get single withdrawal details
 * @route   GET /api/admin/withdrawals/:id
 * @access  Private/Admin
 */
export const getWithdrawalById = async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = await AffiliateWithdrawal.findById(id)
      .populate('user', 'name email phone profileImage createdAt')
      .populate('affiliate', 'affiliateCode totalEarnings totalReferrals totalConversions commissionRate')
      .populate('processedBy', 'name email')
      .lean();

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Get user's complete withdrawal history
    const history = await AffiliateWithdrawal.find({
      user: withdrawal.user._id,
      _id: { $ne: id }
    })
      .select('amount status createdAt transactionId')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        withdrawal,
        history,
      },
    });
  } catch (error) {
   // console.error('Get withdrawal details error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update withdrawal status
 * @route   PUT /api/admin/withdrawals/:id
 * @access  Private/Admin
 */
export const updateWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, notes, paymentDetails } = req.body;
    const adminId = req.user?._id || req.user?.id;

    // Validate status
    const validStatuses = ['pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const withdrawal = await AffiliateWithdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Prevent duplicate processing
    if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      return res.status(400).json({
        success: false,
        message: `Cannot update a ${withdrawal.status} withdrawal`,
      });
    }

    // Track previous status for audit
    const previousStatus = withdrawal.status;
    const previousAmount = withdrawal.amount;

    // Update withdrawal
    const updateData = {
      status,
      processedBy: adminId,
      updatedAt: new Date(),
    };

    if (transactionId) updateData.transactionId = transactionId;
    if (notes) updateData.notes = notes;
    if (paymentDetails) updateData.paymentDetails = { ...withdrawal.paymentDetails, ...paymentDetails };

    if (status === 'processing') {
      updateData.processedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    // Handle affiliate balance updates
    const affiliate = await Affiliate.findById(withdrawal.affiliate);

    if (status === 'failed' && previousStatus !== 'failed') {
      // Refund amount to affiliate
      if (affiliate) {
        affiliate.totalEarnings += withdrawal.amount;
        affiliate.totalWithdrawn = Math.max(0, (affiliate.totalWithdrawn || 0) - withdrawal.amount);
        await affiliate.save();
      }
    }

    if (status === 'completed' && previousStatus !== 'completed') {
      // Update affiliate total withdrawn
      if (affiliate) {
        affiliate.totalWithdrawn = (affiliate.totalWithdrawn || 0) + withdrawal.amount;
        await affiliate.save();
      }
    }

    // If status changed from pending, remove from affiliate's pending balance
    if (previousStatus === 'pending' && (status === 'approved' || status === 'processing')) {
      // Pending amount is already tracked in withdrawal, no need to adjust
    }

    const updatedWithdrawal = await AffiliateWithdrawal.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('user', 'name email')
      .populate('affiliate', 'affiliateCode')
      .populate('processedBy', 'name email');

    // Create notification for affiliate
    await createWithdrawalNotification(updatedWithdrawal, adminId);

    // Log activity
   // console.log(`Withdrawal ${id} updated: ${previousStatus} -> ${status} by admin ${adminId}`);

    res.status(200).json({
      success: true,
      data: updatedWithdrawal,
      message: `Withdrawal ${status} successfully`,
    });
  } catch (error) {
   // console.error('Update withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Bulk process withdrawals
 * @route   POST /api/admin/withdrawals/bulk
 * @access  Private/Admin
 */
export const bulkProcessWithdrawals = async (req, res) => {
  try {
    const { withdrawalIds, status, notes, transactionIdPrefix } = req.body;
    const adminId = req.user?._id || req.user?.id;

    if (!withdrawalIds || withdrawalIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No withdrawals selected',
      });
    }

    if (!status || !['approved', 'processing', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk status. Allowed: approved, processing, failed',
      });
    }

    const results = {
      successful: [],
      failed: [],
      skipped: [],
    };

    for (const id of withdrawalIds) {
      try {
        const withdrawal = await AffiliateWithdrawal.findById(id);

        if (!withdrawal) {
          results.failed.push({ id, reason: 'Withdrawal not found' });
          continue;
        }

        if (withdrawal.status !== 'pending') {
          results.skipped.push({ id, reason: `Already ${withdrawal.status}` });
          continue;
        }

        // Generate transaction ID if completing
        let transactionId = null;
        if (status === 'completed' && transactionIdPrefix) {
          transactionId = `${transactionIdPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }

        // Update withdrawal
        const updateData = {
          status,
          processedBy: adminId,
          updatedAt: new Date(),
        };

        if (transactionId) updateData.transactionId = transactionId;
        if (notes) updateData.notes = notes;

        if (status === 'processing') updateData.processedAt = new Date();
        if (status === 'completed' || status === 'failed') updateData.completedAt = new Date();

        // Handle affiliate balance
        const affiliate = await Affiliate.findById(withdrawal.affiliate);
        if (status === 'failed' && affiliate) {
          affiliate.totalEarnings += withdrawal.amount;
          affiliate.totalWithdrawn = Math.max(0, (affiliate.totalWithdrawn || 0) - withdrawal.amount);
          await affiliate.save();
        }

        if (status === 'completed' && affiliate) {
          affiliate.totalWithdrawn = (affiliate.totalWithdrawn || 0) + withdrawal.amount;
          await affiliate.save();
        }

        const updated = await AffiliateWithdrawal.findByIdAndUpdate(
          id,
          updateData,
          { new: true }
        );

        await createWithdrawalNotification(updated, adminId);
        results.successful.push(id);

      } catch (error) {
        results.failed.push({ id, reason: error.message });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalProcessed: results.successful.length,
        totalSkipped: results.skipped.length,
        totalFailed: results.failed.length,
        results,
      },
      message: `Successfully processed ${results.successful.length} withdrawals`,
    });
  } catch (error) {
   // console.error('Bulk process error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get withdrawal statistics
 * @route   GET /api/admin/withdrawals/stats
 * @access  Private/Admin
 */
export const getWithdrawalStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (period === 'day') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: start } };
    }

    // Get real-time stats
    const [totalStats, dailyStats, methodStats, userStats] = await Promise.all([
      // Overall stats
      AffiliateWithdrawal.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalCount: { $sum: 1 },
            avgAmount: { $avg: '$amount' },
            maxAmount: { $max: '$amount' },
            minAmount: { $min: '$amount' },
          }
        }
      ]),

      // Daily stats for chart
      AffiliateWithdrawal.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        { $limit: 30 },
      ]),

      // Payment method breakdown
      AffiliateWithdrawal.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        {
          $group: {
            _id: '$paymentMethod',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          }
        }
      ]),

      // Top users by withdrawal amount
      AffiliateWithdrawal.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        {
          $group: {
            _id: '$user',
            totalWithdrawn: { $sum: '$amount' },
            count: { $sum: 1 },
          }
        },
        { $sort: { totalWithdrawn: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            'user.name': 1,
            'user.email': 1,
            totalWithdrawn: 1,
            count: 1,
          }
        }
      ])
    ]);

    const stats = totalStats[0] || {};
    const formattedDailyStats = dailyStats.map(d => ({
      date: `${d._id.day}/${d._id.month}/${d._id.year}`,
      total: d.total,
      count: d.count,
    }));

    res.status(200).json({
      success: true,
      data: {
        period,
        overview: {
          totalAmount: stats.totalAmount || 0,
          totalCount: stats.totalCount || 0,
          averageAmount: Math.round(stats.avgAmount || 0),
          maxAmount: stats.maxAmount || 0,
          minAmount: stats.minAmount || 0,
        },
        dailyStats: formattedDailyStats,
        methodBreakdown: methodStats,
        topUsers: userStats,
      },
    });
  } catch (error) {
   // console.error('Get withdrawal stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Export withdrawals as CSV
 * @route   GET /api/admin/withdrawals/export
 * @access  Private/Admin
 */
export const exportWithdrawals = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const withdrawals = await AffiliateWithdrawal.find(query)
      .populate('user', 'name email')
      .populate('affiliate', 'affiliateCode')
      .sort({ createdAt: -1 })
      .lean();

    // Format CSV
    const headers = [
      'ID', 'User', 'Email', 'Amount', 'Status', 'Payment Method',
      'Transaction ID', 'Created At', 'Completed At', 'Notes'
    ];

    const rows = withdrawals.map(w => [
      w._id.toString(),
      w.user?.name || 'N/A',
      w.user?.email || 'N/A',
      w.amount,
      w.status,
      w.paymentMethod,
      w.transactionId || 'N/A',
      new Date(w.createdAt).toLocaleDateString(),
      w.completedAt ? new Date(w.completedAt).toLocaleDateString() : 'N/A',
      w.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=withdrawals-${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    //console.error('Export withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Cancel a pending withdrawal
 * @route   DELETE /api/admin/withdrawals/:id
 * @access  Private/Admin
 */
export const cancelWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id || req.user?.id;

    const withdrawal = await AffiliateWithdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${withdrawal.status} withdrawal`,
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
    withdrawal.processedBy = adminId;
    withdrawal.notes = (withdrawal.notes || '') + ' Cancelled by admin.';
    withdrawal.updatedAt = new Date();
    await withdrawal.save();

    await createWithdrawalNotification(withdrawal, adminId);

    res.status(200).json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal cancelled successfully',
    });
  } catch (error) {
    //console.error('Cancel withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Helper function to create withdrawal notifications
 */
const createWithdrawalNotification = async (withdrawal, adminId) => {
  try {
    const admin = await User.findById(adminId).select('name');
    const adminName = admin?.name || 'Admin';

    let notificationData = {
      user: withdrawal.user,
      type: 'withdrawal_updated',
      title: '',
      message: '',
      priority: 'medium',
      data: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
      },
    };

    switch (withdrawal.status) {
      case 'approved':
        notificationData.title = `✅ Withdrawal Approved - ₹${withdrawal.amount}`;
        notificationData.message = `Your withdrawal request of ₹${withdrawal.amount} has been approved by ${adminName}. It will be processed shortly.`;
        notificationData.priority = 'high';
        break;

      case 'processing':
        notificationData.title = `🔄 Withdrawal Processing - ₹${withdrawal.amount}`;
        notificationData.message = `Your withdrawal of ₹${withdrawal.amount} is being processed. You will receive it within 24-48 hours.`;
        notificationData.priority = 'high';
        break;

      case 'completed':
        notificationData.title = `🎉 Withdrawal Completed - ₹${withdrawal.amount}`;
        notificationData.message = `₹${withdrawal.amount} has been successfully transferred to your account. Transaction ID: ${withdrawal.transactionId || 'N/A'}`;
        notificationData.priority = 'high';
        break;

      case 'failed':
        notificationData.title = `❌ Withdrawal Failed - ₹${withdrawal.amount}`;
        notificationData.message = `Your withdrawal request of ₹${withdrawal.amount} has failed. Amount has been refunded to your wallet. Reason: ${withdrawal.notes || 'Technical issue'}`;
        notificationData.priority = 'high';
        break;

      case 'cancelled':
        notificationData.title = `🚫 Withdrawal Cancelled - ₹${withdrawal.amount}`;
        notificationData.message = `Your withdrawal request of ₹${withdrawal.amount} has been cancelled by ${adminName}. Amount has been refunded to your wallet.`;
        notificationData.priority = 'high';
        break;

      default:
        return;
    }

    await Notification.create(notificationData);
  } catch (error) {
    //console.error('Error creating notification:', error);
     res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Export all functions
export default {
  getWithdrawals,
  getWithdrawalById,
  updateWithdrawal,
  bulkProcessWithdrawals,
  getWithdrawalStats,
  exportWithdrawals,
  cancelWithdrawal,
};