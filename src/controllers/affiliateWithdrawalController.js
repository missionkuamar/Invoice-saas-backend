// backend/src/controllers/affiliateWithdrawalController.js
import Affiliate from '../models/Affiliate.js';
import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';





// // backend/src/controllers/adminWithdrawalController.js
// import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
// import Affiliate from '../models/Affiliate.js';
// import User from '../models/User.js';
// import Notification from '../models/Notification.js';
// import mongoose from 'mongoose';

// @desc    Admin - Get all withdrawal requests
// @route   GET /api/admin/withdrawals
export const adminGetWithdrawals = async (req, res) => {
  try {
    // console.log('📝 GET /api/admin/withdrawals called');
    // console.log('📝 Query params:', req.query);
    
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

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    //console.log('📝 Query:', JSON.stringify(query));

    // Get withdrawals
    const withdrawals = await AffiliateWithdrawal.find(query)
      .populate('user', 'name email phone')
      .populate('affiliate', 'affiliateCode')
      .populate('processedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await AffiliateWithdrawal.countDocuments(query);

    //console.log(`✅ Found ${withdrawals.length} withdrawals`);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
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

   // console.log('📝 GET /api/admin/withdrawals/:id called with id:', id);

    // ✅ Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal ID format',
      });
    }

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
  //  console.error('❌ Admin get withdrawal details error:', error);
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

   // console.log('📝 PUT /api/admin/withdrawals/:id called:', { id, status });

    // ✅ Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal ID format',
      });
    }

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

    // Create notification for affiliate
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
    //console.error('❌ Admin update withdrawal error:', error);
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
    const { withdrawalIds, status = "approved", notes } = req.body;
    const adminId = req.user?._id || req.user?.id;

    if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No withdrawals selected",
      });
    }

    // Validate ObjectIds
    const validIds = withdrawalIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    const invalidIds = withdrawalIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );

    // Fetch only pending withdrawals
    const withdrawals = await AffiliateWithdrawal.find({
      _id: { $in: validIds },
      status: "pending",
    }).select("_id");

    const foundIds = withdrawals.map((w) => w._id.toString());

    // Bulk update
    await AffiliateWithdrawal.updateMany(
      {
        _id: { $in: foundIds },
      },
      {
        $set: {
          status,
          processedBy: adminId,
          ...(notes && { notes }),
        },
      }
    );

    // Prepare response
    const results = [
      ...foundIds.map((id) => ({
        id,
        status: "success",
      })),
      ...invalidIds.map((id) => ({
        id,
        status: "failed",
        error: "Invalid ObjectId",
      })),
      ...validIds
        .filter((id) => !foundIds.includes(id))
        .map((id) => ({
          id,
          status: "failed",
          error: "Withdrawal not found or already processed",
        })),
    ];

    return res.status(200).json({
      success: true,
      data: {
        processed: foundIds.length,
        failed: results.filter((r) => r.status === "failed").length,
        details: results,
      },
    });
  } catch (error) {
    console.error("Bulk process error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
















// // backend/src/controllers/affiliateWithdrawalController.js
// import Affiliate from '../models/Affiliate.js';
// import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
// import User from '../models/User.js';
// import Notification from '../models/Notification.js';

// @desc    Request withdrawal
// @route   POST /api/affiliate/withdraw



// import mongoose from "mongoose";
// import Affiliate from "../models/Affiliate.js";
// import AffiliateWithdrawal from "../models/AffiliateWithdrawal.js";
// import Notification from "../models/Notification.js";
// import User from "../models/User.js";

export const requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const {
      amount,
      paymentMethod = "bank",
      paymentDetails = {},
      notes = "",
    } = req.body;

    const userId = req.user?._id || req.user?.id;

    // ==========================
    // Validate User
    // ==========================
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      await session.abortTransaction();

      return res.status(401).json({
        success: false,
        message: "Invalid user",
      });
    }

    // ==========================
    // Validate Amount
    // ==========================
    const withdrawAmount = Number(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal amount",
      });
    }

    const MIN_WITHDRAWAL = 100;

    if (withdrawAmount < MIN_WITHDRAWAL) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`,
      });
    }

    // ==========================
    // Validate Payment Details
    // ==========================

    if (paymentMethod === "bank") {
      if (
        !paymentDetails.accountHolderName ||
        !paymentDetails.accountNumber ||
        !paymentDetails.ifsc
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Complete bank details are required.",
        });
      }
    }

    if (paymentMethod === "upi") {
      if (!paymentDetails.upiId) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "UPI ID is required.",
        });
      }
    }

    // ==========================
    // Find User
    // ==========================
    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================
    // Atomic Balance Update
    // ==========================
    const affiliate = await Affiliate.findOneAndUpdate(
      {
        user: userId,
        totalEarnings: { $gte: withdrawAmount },
      },
      {
        $inc: {
          totalEarnings: -withdrawAmount,
          totalWithdrawn: withdrawAmount,
        },
      },
      {
        new: true,
        session,
      }
    );

    if (!affiliate) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Insufficient balance or affiliate not found",
      });
    }

    // ==========================
    // Create Withdrawal
    // ==========================
    const [withdrawal] = await AffiliateWithdrawal.create(
      [
        {
          affiliate: affiliate._id,
          user: userId,
          amount: withdrawAmount,
          paymentMethod,
          paymentDetails: {
            ...paymentDetails,
            userName: user.name,
            userEmail: user.email,
          },
          notes,
          status: "pending",
        },
      ],
      { session }
    );

    // ==========================
    // Find Admins
    // ==========================
    const admins = await User.find({
      role: { $in: ["admin", "super_admin"] },
    })
      .select("_id")
      .lean();

    // ==========================
    // Notifications
    // ==========================
    const notifications = [];

    admins.forEach((admin) => {
      notifications.push({
        user: admin._id,
        type: "withdrawal_request",
        title: `💰 New Withdrawal Request - ₹${withdrawAmount}`,
        message: `${user.name} requested ₹${withdrawAmount}`,
        priority: "high",
        data: {
          withdrawalId: withdrawal._id,
        },
      });
    });

    notifications.push({
      user: user._id,
      type: "withdrawal_request",
      title: "Withdrawal Request Submitted",
      message: `Your withdrawal request of ₹${withdrawAmount} has been submitted successfully.`,
      priority: "medium",
      data: {
        withdrawalId: withdrawal._id,
      },
    });

    await Notification.insertMany(notifications, { session });

    // ==========================
    // Commit
    // ==========================
    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: {
        withdrawal,
        remainingEarnings: affiliate.totalEarnings,
      },
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Withdrawal Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  } finally {
    await session.endSession();
  }
};
// @desc    Get withdrawal history
// @route   GET /api/affiliate/withdrawals
export const getWithdrawals = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    
   // console.log('📝 Get withdrawals for user:', userId);

    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
    //  console.log('❌ Affiliate not found for user:', userId);
      return res.status(404).json({
        success: false,
       // message: 'Not an affiliate member',
      });
    }

    const { status, page = 1, limit = 20 } = req.query;

    const query = { affiliate: affiliate._id };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [withdrawals, total] = await Promise.all([
      AffiliateWithdrawal.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AffiliateWithdrawal.countDocuments(query),
    ]);

   // console.log(`✅ Found ${withdrawals.length} withdrawals`);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    //console.error('❌ Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Cancel withdrawal
// @route   POST /api/affiliate/withdraw/:id/cancel
export const cancelWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;

   // console.log('📝 Cancel withdrawal:', { id, userId });

    const withdrawal = await AffiliateWithdrawal.findOne({ 
      _id: id,
      user: userId,
      status: 'pending'
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
      affiliate.totalWithdrawn = (affiliate.totalWithdrawn || 0) - withdrawal.amount;
      await affiliate.save();
    }

    withdrawal.status = 'cancelled';
    await withdrawal.save();

   // console.log('✅ Withdrawal cancelled:', id);

    res.status(200).json({
      success: true,
      message: 'Withdrawal cancelled successfully',
      data: withdrawal,
    });
  } catch (error) {
   // console.error('❌ Cancel withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



























// Helper function to create notifications
const createWithdrawalNotification = async (withdrawal, user, affiliate) => {
  try {
    // 1. Create notification for ADMIN
    const adminMessage = `
      New Withdrawal Request
      
      Affiliate: ${user.name} (${user.email})
      Amount: ₹${withdrawal.amount}
      Method: ${withdrawal.paymentMethod}
      Account: ${withdrawal.paymentDetails?.accountHolderName || withdrawal.paymentDetails?.upiId || withdrawal.paymentDetails?.paypalEmail || 'N/A'}
      Requested: ${new Date().toLocaleString()}
      
      Please review and process this request.
    `;

    // Find all admins and super admins
    const admins = await User.find({ 
      role: { $in: ['admin', 'super_admin'] } 
    });

    // Create notification for each admin
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        type: 'withdrawal_request',
        title: `💰 New Withdrawal Request - ₹${withdrawal.amount}`,
        message: `${user.name} requested withdrawal of ₹${withdrawal.amount}`,
        priority: 'high',
        data: {
          withdrawalId: withdrawal._id,
          affiliateId: affiliate._id,
          userId: user._id,
          amount: withdrawal.amount,
          paymentMethod: withdrawal.paymentMethod,
          userName: user.name,
          userEmail: user.email,
        },
      });
    }

    // 2. Create notification for AFFILIATE (confirmation)
    await Notification.create({
      user: user._id,
      type: 'withdrawal_request',
      title: `✅ Withdrawal Request Submitted - ₹${withdrawal.amount}`,
      message: `Your withdrawal request of ₹${withdrawal.amount} has been submitted. Admin will process it within 2-3 business days.`,
      priority: 'medium',
      data: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: 'pending',
      },
    });

    // 3. If amount is high, send high priority notification
    if (withdrawal.amount >= 5000) {
      const highValueMessage = `
        ⚠️ HIGH VALUE WITHDRAWAL ALERT!
        
        Affiliate: ${user.name} (${user.email})
        Amount: ₹${withdrawal.amount}
        Method: ${withdrawal.paymentMethod}
        
        Please process this request urgently.
      `;

      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          type: 'withdrawal_request',
          title: `⚠️ HIGH VALUE Withdrawal - ₹${withdrawal.amount}`,
          message: `${user.name} requested HIGH VALUE withdrawal of ₹${withdrawal.amount}`,
          priority: 'high',
          data: {
            withdrawalId: withdrawal._id,
            amount: withdrawal.amount,
            isHighValue: true,
          },
        });
      }
    }

   // console.log(`✅ Notifications created for admins and user`);
  } catch (error) {
   // console.error('Notification creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get withdrawal history with 

// @desc    Cancel withdrawal request
// @route   POST /api/affiliate/withdraw/:id/cancel


// @desc    Get withdrawal statistics for affiliate
// @route   GET /api/affiliate/withdrawals/stats
export const getWithdrawalStats = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    
    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'Not an affiliate member',
      });
    }

    const stats = await AffiliateWithdrawal.aggregate([
      { $match: { affiliate: affiliate._id } },
      {
        $group: {
          _id: null,
          totalWithdrawn: { 
            $sum: { 
              $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] 
            } 
          },
          pendingWithdrawals: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'approved', 'processing']] }, '$amount', 0]
            }
          },
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
      totalRequests: 0,
      successfulRequests: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        ...result,
        availableBalance: affiliate.totalEarnings,
        totalEarnings: affiliate.totalEarnings + result.totalWithdrawn,
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