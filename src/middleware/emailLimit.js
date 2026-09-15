// backend/src/middleware/emailLimit.js
import User from '../models/User.js';

export const checkEmailLimit = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user can send more emails
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      const planLimits = {
        free: 5,
        basic: 300,
        pro: 1000,
        enterprise: 2000,
      };
      
      const limit = user.subscription.limits.monthly;
      const resetDate = user.subscription.limits.resetDate;
      
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${limit} emails for this month.`,
        data: {
          plan: user.subscription.plan,
          limit: limit,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
          resetDate: resetDate,
          upgradeRequired: true,
        },
      });
    }

    // Store user in request for later use
    req.userData = user;
    next();
  } catch (error) {
    console.error('Email limit check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking email limit',
    });
  }
};