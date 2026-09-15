// backend/src/routes/authRoutes.js
import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  createAdmin,
  getUsers,
  updateUserRole,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

// Admin routes
router.post('/create-admin', createAdmin);
router.get('/users', protect, getUsers);
router.put('/users/:id/role', protect, updateUserRole);

export default router;