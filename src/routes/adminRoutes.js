// backend/src/routes/adminRoutes.js
import express from 'express';
import {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  getInvoices,
  deleteInvoice,
  getSubscriptions,
  updateSubscription,
  getSystemSettings,
  getWithdrawals,
  getWithdrawalStats,
  exportWithdrawals,
  getWithdrawalById,
  updateWithdrawal,
  cancelWithdrawal,
  bulkProcessWithdrawals,
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Dashboard
router.get('/stats', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Invoice Management
router.get('/invoices', getInvoices);
router.delete('/invoices/:id', deleteInvoice);

// Subscription Management
router.get('/subscriptions', getSubscriptions);
router.put('/subscriptions/:id', updateSubscription);


// System Settings
router.get('/settings', getSystemSettings);

export default router;