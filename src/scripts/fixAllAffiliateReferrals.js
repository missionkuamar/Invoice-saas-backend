// backend/src/scripts/fixAllAffiliateReferrals.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Affiliate from '../models/Affiliate.js';
import AffiliateReferral from '../models/AffiliateReferral.js';
import connectDB from '../config/db.js';

dotenv.config();

const fixAllAffiliateReferrals = async () => {
  try {
    await connectDB();

   // console.log('🔍 Finding affiliate...');
    const affiliate = await Affiliate.findOne({ affiliateCode: 'REFVEFDGI' });
    if (!affiliate) {
     // console.log('❌ Affiliate REFVEFDGI not found');
      return;
    }
    //console.log('✅ Affiliate found:', affiliate.affiliateCode);

    // Find all users who registered but don't have referrals
    const users = await User.find({
      email: { $in: ['user1@gmail.com', 'user2@gmail.com', 'user4@gmail.com', 'user5@gmail.com'] }
    });

   // console.log(`👥 Found ${users.length} users to fix`);

    for (const user of users) {
      // Check if user already has a referral
      const existingReferral = await AffiliateReferral.findOne({
        referredUser: user._id,
      });

      if (existingReferral) {
       // console.log(`ℹ️ User ${user.email} already has referral: ${existingReferral._id}`);
        // Update to subscribed if not already
        if (existingReferral.status !== 'subscribed') {
          existingReferral.status = 'subscribed';
          existingReferral.subscriptionPlan = 'enterprise';
          existingReferral.subscriptionAmount = 2999;
          existingReferral.commission = 299.90;
          existingReferral.totalCommissionPaid = 299.90;
          existingReferral.commissionCount = 1;
          existingReferral.lastCommissionDate = new Date();
          existingReferral.convertedAt = new Date();
          await existingReferral.save();
          //console.log(`✅ Updated referral for ${user.email}`);
        }
        continue;
      }

      // Create referral for user
      const referral = await AffiliateReferral.create({
        affiliate: affiliate._id,
        referredUser: user._id,
        status: 'subscribed',
        subscriptionPlan: 'enterprise',
        subscriptionAmount: 2999,
        commission: 299.90,
        totalCommissionPaid: 299.90,
        commissionCount: 1,
        lastCommissionDate: new Date(),
        convertedAt: new Date(),
        createdAt: new Date(),
      });

    //  console.log(`✅ Created referral for ${user.email}: ${referral._id}`);
    }

    // Update affiliate totals
    const totalReferrals = await AffiliateReferral.countDocuments({
      affiliate: affiliate._id,
      status: 'subscribed'
    });

    const totalEarnings = await AffiliateReferral.aggregate([
      { $match: { affiliate: affiliate._id, status: 'subscribed' } },
      { $group: { _id: null, total: { $sum: '$commission' } } }
    ]);

    affiliate.totalReferrals = totalReferrals;
    affiliate.totalConversions = totalReferrals;
    affiliate.totalEarnings = totalEarnings[0]?.total || 0;

    await affiliate.save();

    // console.log(`💰 Total earnings for ${affiliate.affiliateCode}: ₹${affiliate.totalEarnings}`);
    // console.log(`👥 Total referrals: ${affiliate.totalReferrals}`);

    process.exit(0);
  } catch (error) {
    //console.error('Error:', error);
    process.exit(1);
  }
};

fixAllAffiliateReferrals();