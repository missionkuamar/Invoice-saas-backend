// backend/src/middleware/affiliateTracking.js
import Affiliate from '../models/Affiliate.js';
import AffiliateReferral from '../models/AffiliateReferral.js';
import User from '../models/User.js';

// Track affiliate referral when user registers
export const trackAffiliateRegistration = async (req, res, next) => {
  // Check session for affiliate referral
  if (req.session?.affiliateReferral) {
    const { referralId, affiliateId } = req.session.affiliateReferral;
    
    // When user registers, update the referral
    req.affiliateReferral = { referralId, affiliateId };
  }
  
  next();
};

// Check if user is an affiliate and can refer others
export const checkAffiliateStatus = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const affiliate = await Affiliate.findOne({ 
      user: userId,
      status: 'active',
    });
    
    req.isAffiliate = !!affiliate;
    req.affiliateCode = affiliate?.affiliateCode || null;
    
    next();
  } catch (error) {
   // console.error('Check affiliate status error:', error);
    next();
  }
};

// Generate affiliate stats for user
export const getAffiliateStats = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const affiliate = await Affiliate.findOne({ user: userId });
    
    if (affiliate) {
      req.affiliateStats = {
        totalEarnings: affiliate.totalEarnings || 0,
        totalReferrals: affiliate.totalReferrals || 0,
        totalConversions: affiliate.totalConversions || 0,
        commissionRate: affiliate.commissionRate || 10,
      };
    }
    
    next();
  } catch (error) {
    //.error('Get affiliate stats error:', error);
    next();
  }
};