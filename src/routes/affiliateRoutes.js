// backend/src/routes/affiliateRoutes.js
import express from 'express';
import {
  joinAffiliateProgram,
  getAffiliateDashboard,
  createAffiliateLink,
  getAffiliateLinks,
  updateAffiliateLink,
  deleteAffiliateLink,
  trackAffiliateClick,
  trackAffiliateConversion,
  getEarnings,
  requestWithdrawal,
  getWithdrawalHistory,
  getWithdrawalDetails,
} from '../controllers/affiliateController.js';
import { protect } from '../middleware/auth.js';
import { getWithdrawals } from '../models/affiliateWithdrawalController.js';
import {
  // ... existing imports
  debugAllReferrals,
  debugAffiliateByCode,
} from '../controllers/affiliateController.js';
import { cancelWithdrawal } from '../controllers/affiliateWithdrawalController.js';

const router = express.Router();

// ✅ PUBLIC ROUTE - This handles the /r/:slug redirect
// This must be before the protected routes
router.get('/r/:slug', trackAffiliateClick);

// Protected routes
router.use(protect);

// Affiliate program
router.post('/join', joinAffiliateProgram);
router.get('/dashboard', getAffiliateDashboard);

// Affiliate links
router.get('/links', getAffiliateLinks);
router.post('/links', createAffiliateLink);
router.put('/links/:id', updateAffiliateLink);
router.delete('/links/:id', deleteAffiliateLink);

// Tracking
router.post('/track-conversion', trackAffiliateConversion);

// Earnings

// router.post('/withdrawals', requestWithdrawal);
// router.delete('/withdrawals/:id', cancelWithdrawal);
export default router;