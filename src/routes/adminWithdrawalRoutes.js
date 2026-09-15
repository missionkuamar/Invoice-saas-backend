// backend/src/routes/adminWithdrawalRoutes.js
import express from 'express';
import {
  adminGetWithdrawals,
  adminGetWithdrawalDetails,
  adminUpdateWithdrawal,
  adminBulkProcessWithdrawals,
} from '../controllers/adminWithdrawalController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
 // console.log('📝 [Admin Withdrawals] Route hit:', req.method, req.originalUrl);
  next();
});

router.use(protect);
router.use(adminOnly);

// ✅ IMPORTANT: SPECIFIC ROUTES FIRST
// GET / - List all withdrawals
router.get('/', adminGetWithdrawals);

// POST /bulk - Bulk process
router.post('/bulk', adminBulkProcessWithdrawals);

// ✅ DYNAMIC ROUTES LAST
// GET /:id - Get single withdrawal
router.get('/:id', (req, res, next) => {
  const id = req.params.id;
  // Skip if id is 'bulk' or empty
  if (!id || id === 'bulk') {
    return res.status(400).json({
      success: false,
      message: 'Invalid withdrawal ID'
    });
  }
  next();
}, adminGetWithdrawalDetails);

// PUT /:id - Update withdrawal
router.put('/:id', (req, res, next) => {
  const id = req.params.id;
  if (!id || id === 'bulk') {
    return res.status(400).json({
      success: false,
      message: 'Invalid withdrawal ID'
    });
  }
  next();
}, adminUpdateWithdrawal);

export default router;