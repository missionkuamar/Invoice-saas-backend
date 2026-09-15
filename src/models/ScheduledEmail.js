import mongoose from 'mongoose';

const scheduledEmailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toEmail: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  scheduleTime: {
    type: Date,
    required: true
  },
   attachments: {
    type: Array,
    default: []
  },
   emailType: {
    type: String,
    enum: ['invoice', 'reminder', 'overdue', 'confirmation', 'cancellation', 'revised', 'proforma', 'credit_note', 'recurring'],
    default: 'invoice'
  },
  invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  sentAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const ScheduledEmail = mongoose.model('ScheduledEmail', scheduledEmailSchema);