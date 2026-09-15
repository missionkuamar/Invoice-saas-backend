import express from 'express';
import { deleteEmail, 
    getMyEmails, 
    scheduleEmail,
     sendInvoice,
  sendPaymentReminder,
  sendOverdueAlert,
  sendPaymentConfirmation,
  sendCancellation,
  sendRevisedInvoice,
  sendBulkInvoices,
  sendRecurringInvoice,
  sendProformaInvoice,
  sendCreditNote,
  getEmailStats,
  getEmailStatsSummary,
  
 } from '../controllers/emailController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../config/multer.js';



const router = express.Router();

router.post('/schedule', protect, scheduleEmail);
router.get('/my-emails', protect, getMyEmails);
router.delete('/:id', protect, deleteEmail);

router.get('/stats',protect,  getEmailStats);
router.get('/stats/summary',protect,  getEmailStatsSummary); 
// All email types
router.post('/send-invoice', protect, upload .array('attachments', 5), sendInvoice);
router.post('/send-reminder', protect, sendPaymentReminder);
router.post('/send-overdue', protect, sendOverdueAlert);
router.post('/send-confirmation', protect, sendPaymentConfirmation);
router.post('/send-cancellation', protect, sendCancellation);
router.post('/send-revised', protect, sendRevisedInvoice);
router.post('/send-bulk', protect, sendBulkInvoices);
router.post('/send-recurring', protect, sendRecurringInvoice);
router.post('/send-proforma', protect, sendProformaInvoice);
router.post('/send-credit-note', protect, sendCreditNote);


// http://localhost:5000/api/emails/my-emails
export default router;