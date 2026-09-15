import express from 'express';
import {
  getPlans,
  createOrder,
  verifyPayment,
  cancelSubscription,
  getCurrentSubscription,
} from '../controllers/subscriptionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/plans', getPlans);
router.get('/current', protect, getCurrentSubscription);
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/cancel', protect, cancelSubscription);

export default router;