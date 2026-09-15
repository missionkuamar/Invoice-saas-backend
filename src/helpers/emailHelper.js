// backend/src/helpers/emailHelper.js
import User from '../models/User.js';

export const incrementEmailCount = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (user) {
      await user.incrementEmailCount();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error incrementing email count:', error);
    return false;
  }
};

export const getEmailStats = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;
    
    return {
      plan: user.subscription.plan,
      limit: user.subscription.limits.monthly,
      used: user.subscription.limits.used,
      remaining: user.getRemainingEmails(),
      resetDate: user.subscription.limits.resetDate,
      percentage: Math.round((user.subscription.limits.used / user.subscription.limits.monthly) * 100),
    };
  } catch (error) {
    console.error('Error getting email stats:', error);
    return null;
  }
};