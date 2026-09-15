// backend/src/controllers/affiliateWithdrawalController.js
import Affiliate from '../models/Affiliate.js';
import AffiliateWithdrawal from '../models/AffiliateWithdrawal.js';
import User from '../models/User.js';

// @desc    Request withdrawal
// @route   POST /api/affiliate/withdraw
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body;
    const userId = req.user?._id || req.user?.id;

    const affiliate = await Affiliate.findOne({ user: userId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
       // message: 'Not an affiliate member',
      });
    }

    if (affiliate.totalEarnings < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient earnings',
      });
    }

    if (amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹100',
      });
    }

    // Create withdrawal request
    const withdrawal = await AffiliateWithdrawal.create({
      affiliate: affiliate._id,
      user: userId,
      amount,
      paymentMethod,
      paymentDetails,
      status: 'pending',
    });

    // Deduct from earnings (will be refunded if cancelled)
    affiliate.totalEarnings -= amount;
    await affiliate.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawal,
    });
  } catch (error) {
    //console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get withdrawal history
// @route   GET /api/affiliate/withdrawals
export const getWithdrawals = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const affiliate = await Affiliate.findOne({ user: userId });
    
    if (!affiliate) {
      return res.status(404).json({
        success: false,
      //  message: 'Not an affiliate member',
      });
    }

    const withdrawals = await AffiliateWithdrawal.find({ affiliate: affiliate._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
  //  console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Admin - Update withdrawal status
// @route   PUT /api/admin/withdrawals/:id
export const updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, notes } = req.body;

    const withdrawal = await AffiliateWithdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    withdrawal.status = status;
    if (transactionId) withdrawal.transactionId = transactionId;
    if (notes) withdrawal.notes = notes;
    
    if (status === 'processing') {
      withdrawal.processedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      withdrawal.completedAt = new Date();
    }

    // If failed or cancelled, refund the amount
    if (status === 'failed' || status === 'cancelled') {
      const affiliate = await Affiliate.findById(withdrawal.affiliate);
      if (affiliate) {
        affiliate.totalEarnings += withdrawal.amount;
        await affiliate.save();
      }
    }

    await withdrawal.save();

    res.status(200).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
   // console.error('Update withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};