import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createInvoice,
  getMyInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice
} from '../controllers/invoiceEmailController.js';

const router = express.Router();

router.post('/create', protect, createInvoice);
router.get('/my-invoices', protect, getMyInvoices);
router.get('/:id', protect, getInvoiceById);
router.put('/:id', protect, updateInvoice);
router.delete('/:id', protect, deleteInvoice);

export default router;