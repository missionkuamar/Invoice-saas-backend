// backend/src/routes/withdrawalRoutes.js
import express from 'express';
import {
  requestWithdrawal,
  getWithdrawals,
  cancelWithdrawal,
  getWithdrawalStats,
} from '../controllers/affiliateWithdrawalController.js';
import { protect } from '../middleware/auth.js';
import { bulkProcessWithdrawals, exportWithdrawals, getWithdrawalById, updateWithdrawal } from '../controllers/adminController.js';
import { debugAffiliateByCode, debugAllReferrals, getEarnings, getWithdrawalDetails, getWithdrawalHistory } from '../controllers/affiliateController.js';

const router = express.Router();

router.use(protect);

router.post('/withdraw', requestWithdrawal);

router.get('/withdrawals', getWithdrawals);

router.get('/withdrawals/stats', getWithdrawalStats);
router.post('/withdraw/:id/cancel', cancelWithdrawal);
router.get('/withdrawals/:id', getWithdrawalById);
//router.get('/withdrawals', getWithdrawals);
//router.get('/withdrawals/stats', getWithdrawalStats);
router.get('/withdrawals/export', exportWithdrawals);
router.put('/withdrawals/:id', updateWithdrawal);
//router.delete('/withdrawals/:id', cancelWithdrawal);
router.post('/withdrawals/bulk', bulkProcessWithdrawals);
//

router.get('/earnings', getEarnings);
//router.post('/withdraw', requestWithdrawal);
router.get('/debug/all', protect, debugAllReferrals);
router.get('/debug/code/:code', protect, debugAffiliateByCode);
router.get('/withdrawals', protect, getWithdrawals);
router.post('/withdraw/:id/cancel', cancelWithdrawal);


// Withdrawal routes
router.get('/withdrawals/:id', getWithdrawalDetails);
router.get('/withdrawals', getWithdrawalHistory);
export default router;