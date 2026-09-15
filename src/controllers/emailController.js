import Invoice from '../models/Invoice.js';
import { ScheduledEmail } from '../models/ScheduledEmail.js';
import {
  getInvoiceEmailHTML,
  getReminderEmailHTML,
  getOverdueEmailHTML,
  getPaymentConfirmationHTML,
  getCancellationEmailHTML,
  getRevisedEmailHTML,
  getBulkInvoiceEmailHTML,
  getRecurringInvoiceHTML,
  getProformaInvoiceHTML,
  getCreditNoteHTML
} from '../services/invoiceTemplates.js';
import { generateInvoicePDF } from '../services/pdfGenerator.js';
import mongoose from "mongoose";

import { checkEmailLimit } from '../middleware/emailLimit.js';
import { incrementEmailCount } from '../helpers/emailHelper.js';
import User from '../models/User.js';
const processEmailWithLimit = async (userId, emailData) => {
  const user = await User.findById(userId);
  
  // Check if user can send email
  const canSend = await user.canSendEmail();
  if (!canSend) {
    throw new Error(`Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`);
  }
  
  // Create scheduled email
  const scheduledEmail = await ScheduledEmail.create(emailData);
  
  // Increment email count
  await user.incrementEmailCount();
  
  return scheduledEmail;
};

// 1. Schedule Simple Email
export const scheduleEmail = async (req, res) => {
  try {
    const { toEmail, subject, message, scheduleTime } = req.body;

    if (!toEmail || !subject || !message || !scheduleTime) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail,
      subject,
      message,
      scheduleTime: new Date(scheduleTime)
    });

    // Increment email count
    await user.incrementEmailCount();

    res.status(201).json({
      success: true,
      message: 'Email scheduled successfully',
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
      }
    });

  } catch (error) {
    console.error('Schedule Email Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 2. Send Invoice
export const sendInvoice = async (req, res) => {
  try {
    const { invoiceId, scheduleTime, attachments = [] } = req.body;

    // Validate invoice id
    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    // Find invoice belonging to logged in user
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Client email required
    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email is required",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    // Validate schedule time
    const scheduledAt = scheduleTime
      ? new Date(scheduleTime)
      : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    // Generate PDF
    const pdfPath = await generateInvoicePDF(invoice);

    if (!pdfPath) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate invoice PDF",
      });
    }

    // Default attachment (Invoice PDF)
    const emailAttachments = [
      {
        filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        path: pdfPath,
        contentType: "application/pdf",
      },
    ];

    // Additional attachments
    if (Array.isArray(attachments) && attachments.length > 0) {
      emailAttachments.push(...attachments);
    }

    // Schedule email
    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `Invoice #${invoice.invoiceNumber} from ${req.user.name || "Your Company"}`,
      message: getInvoiceEmailHTML(invoice),
      scheduleTime: scheduledAt,
      attachments: emailAttachments,
      emailType: "invoice",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    // Update invoice status
    invoice.status = "sent";
    await invoice.save();

    return res.status(201).json({
      success: true,
      message: scheduleTime
        ? "Invoice scheduled successfully"
        : "Invoice queued successfully",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Send Invoice Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

// 3. Payment Reminder ⏰
export const sendPaymentReminder = async (req, res) => {
  try {
    const { invoiceId, scheduleTime } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const today = new Date();
    const dueDate = new Date(invoice.dueDate);

    const daysLeft = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: daysLeft >= 0
        ? `⏰ Reminder: Invoice #${invoice.invoiceNumber} due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
        : `⚠️ Invoice #${invoice.invoiceNumber} is overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""}`,
      message: getReminderEmailHTML(invoice, daysLeft),
      scheduleTime: scheduledAt,
      emailType: "reminder",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    return res.status(201).json({
      success: true,
      message: "Payment reminder scheduled successfully",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Payment Reminder Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

// 4. Overdue Payment Alert 🚨
export const sendOverdueAlert = async (req, res) => {
  try {
    const { invoiceId, scheduleTime } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    let daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue < 0) daysOverdue = 0;

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `🚨 OVERDUE: Invoice #${invoice.invoiceNumber} - ${daysOverdue} Day${daysOverdue !== 1 ? "s" : ""} Overdue`,
      message: getOverdueEmailHTML(invoice, daysOverdue),
      scheduleTime: scheduledAt,
      emailType: "overdue",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    invoice.status = "overdue";
    await invoice.save();

    return res.status(201).json({
      success: true,
      message: "Overdue alert scheduled successfully",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Overdue Alert Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

// 5. Payment Confirmation ✅
export const sendPaymentConfirmation = async (req, res) => {
  try {
    const { invoiceId, paymentDetails = {}, scheduleTime } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Invoice is already marked as paid.",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `✅ Payment Confirmed - Invoice #${invoice.invoiceNumber}`,
      message: getPaymentConfirmationHTML(invoice, paymentDetails),
      scheduleTime: scheduledAt,
      emailType: "confirmation",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    invoice.status = "paid";
    await invoice.save();

    return res.status(201).json({
      success: true,
      message: "Payment confirmation scheduled successfully.",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Payment Confirmation Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// 6. Invoice Cancellation ❌
export const sendCancellation = async (req, res) => {
  try {
    const { invoiceId, reason = "No reason provided.", scheduleTime } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Invoice is already cancelled.",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `❌ Invoice #${invoice.invoiceNumber} Cancelled`,
      message: getCancellationEmailHTML(invoice, reason),
      scheduleTime: scheduledAt,
      emailType: "cancellation",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    invoice.status = "cancelled";
    await invoice.save();

    return res.status(201).json({
      success: true,
      message: "Cancellation email scheduled successfully.",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Cancellation Email Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// 7. Invoice Updated/Revised 📝
export const sendRevisedInvoice = async (req, res) => {
  console.log("\n================== sendRevisedInvoice ==================");
  console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));
  console.log("👤 User:", req.user?._id);

  try {
    const { invoiceId, changes = [], scheduleTime } = req.body;

    console.log("📌 Invoice ID:", invoiceId);
    console.log("📌 Changes:", changes);
    console.log("📌 Changes Type:", typeof changes);
    console.log("📌 Is Array:", Array.isArray(changes));
    console.log("📌 Schedule Time:", scheduleTime);

    // Validate Invoice ID
    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      console.log("❌ Invalid Invoice ID");
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    console.log("🔍 Finding Invoice...");

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    console.log("📄 Invoice:", invoice);

    if (!invoice) {
      console.log("❌ Invoice Not Found");
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    console.log("📧 Client:", invoice.client);

    if (!invoice.client?.email) {
      console.log("❌ Client Email Missing");
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    console.log("📌 Invoice Status:", invoice.status);

    if (invoice.status === "cancelled") {
      console.log("❌ Invoice Cancelled");
      return res.status(400).json({
        success: false,
        message: "Cancelled invoices cannot be revised.",
      });
    }

    console.log("👤 Finding User...");

    const user = await User.findById(req.user._id);

    console.log("👤 User Found:", !!user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("📬 Checking Email Limit...");

    const canSend = await user.canSendEmail();

    console.log("📬 Can Send:", canSend);
    console.log("📬 Remaining:", user.getRemainingEmails());

    if (!canSend) {
      console.log("❌ Email Limit Exceeded");

      return res.status(403).json({
        success: false,
        message: "Email limit exceeded.",
      });
    }

    const scheduledAt = scheduleTime
      ? new Date(scheduleTime)
      : new Date();

    console.log("⏰ Scheduled At:", scheduledAt);

    if (isNaN(scheduledAt.getTime())) {
      console.log("❌ Invalid Schedule Time");

      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    console.log("\n================ TEMPLATE DEBUG ================");

    console.log("Changes Raw:", changes);
    console.log("Changes Type:", typeof changes);
    console.log("Is Array:", Array.isArray(changes));

    if (Array.isArray(changes)) {
      console.log("Array Length:", changes.length);

      changes.forEach((item, index) => {
        console.log(`changes[${index}] =>`, item);
      });
    } else {
      console.log("❌ changes is NOT an array");
    }

    console.log("Generating HTML...");

    const html = getRevisedEmailHTML(invoice, changes);

    console.log("✅ HTML Generated");
    console.log("HTML Length:", html.length);

    console.log("Creating Scheduled Email...");

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `📝 Revised Invoice #${invoice.invoiceNumber}`,
      message: html,
      scheduleTime: scheduledAt,
      emailType: "revised",
      invoiceId: invoice._id,
    });

    console.log("✅ Scheduled Email Created");
    console.log(scheduledEmail);

    console.log("Increment Email Count...");

    await user.incrementEmailCount();

    console.log("✅ Email Count Updated");

    console.log("================ SUCCESS ================\n");

    return res.status(201).json({
      success: true,
      message: "Revised invoice scheduled successfully.",
      data: scheduledEmail,
    });

  } catch (error) {
    console.log("\n================ ERROR ================");
    console.error(error);
    console.error(error.stack);

    if (req.body) {
      console.log("Request Body:", JSON.stringify(req.body, null, 2));
      console.log("Changes:", req.body.changes);
      console.log("Changes Type:", typeof req.body.changes);
      console.log("Is Array:", Array.isArray(req.body.changes));
    }

    console.log("=======================================\n");

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 8. Bulk Invoice to Multiple Clients 📨
export const sendBulkInvoices = async (req, res) => {
  try {
    const { invoices = [], scheduleTime } = req.body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invoices array is required.",
      });
    }

    // Check email limit for each invoice
    const user = await User.findById(req.user._id);
    const remainingEmails = user.getRemainingEmails();
    
    if (remainingEmails < invoices.length) {
      return res.status(403).json({
        success: false,
        message: `Not enough email credits. You need ${invoices.length} emails but only ${remainingEmails} remaining.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: remainingEmails,
          required: invoices.length,
        }
      });
    }

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time.",
      });
    }

    const scheduledEmails = [];
    const failedInvoices = [];

    for (const item of invoices) {
      try {
        if (!item.invoiceId || !mongoose.Types.ObjectId.isValid(item.invoiceId)) {
          failedInvoices.push({ invoiceId: item.invoiceId, reason: "Invalid invoice id" });
          continue;
        }

        const invoice = await Invoice.findOne({
          _id: item.invoiceId,
          user: req.user._id,
        });

        if (!invoice) {
          failedInvoices.push({ invoiceId: item.invoiceId, reason: "Invoice not found" });
          continue;
        }

        if (!invoice.client?.email) {
          failedInvoices.push({ invoiceId: invoice._id, reason: "Client email not found" });
          continue;
        }

        const pdfPath = await generateInvoicePDF(invoice);

        if (!pdfPath) {
          failedInvoices.push({ invoiceId: invoice._id, reason: "PDF generation failed" });
          continue;
        }

        const scheduledEmail = await ScheduledEmail.create({
          userId: req.user._id,
          toEmail: invoice.client.email,
          subject: `Invoice #${invoice.invoiceNumber} from ${req.user.name || "Your Company"}`,
          message: getBulkInvoiceEmailHTML(invoice),
          scheduleTime: scheduledAt,
          attachments: [{
            filename: `Invoice-${invoice.invoiceNumber}.pdf`,
            path: pdfPath,
            contentType: "application/pdf",
          }],
          emailType: "invoice",
          invoiceId: invoice._id,
        });

        scheduledEmails.push(scheduledEmail);

        // Increment email count for each successful email
        await user.incrementEmailCount();

        invoice.status = "sent";
        await invoice.save();
      } catch (err) {
        console.error(err);
        failedInvoices.push({
          invoiceId: item.invoiceId,
          reason: err.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${scheduledEmails.length} invoice(s) scheduled successfully.`,
      successCount: scheduledEmails.length,
      failedCount: failedInvoices.length,
      scheduledEmails,
      failedInvoices,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Bulk Invoice Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// 9. Recurring Invoice 🔄
export const sendRecurringInvoice = async (req, res) => {
  try {
    const { invoiceId, cycle, scheduleTime } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    const allowedCycles = ["daily", "weekly", "monthly", "quarterly", "yearly"];

    if (!cycle || !allowedCycles.includes(cycle.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Cycle must be one of: ${allowedCycles.join(", ")}`,
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled invoices cannot be scheduled as recurring.",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `🔄 Recurring Invoice #${invoice.invoiceNumber} - ${cycle}`,
      message: getRecurringInvoiceHTML(invoice, cycle),
      scheduleTime: scheduledAt,
      emailType: "recurring",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    return res.status(201).json({
      success: true,
      message: "Recurring invoice scheduled successfully.",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Recurring Invoice Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// 10. Proforma Invoice 📄
export const sendProformaInvoice = async (req, res) => {
  try {
    const { invoiceId, scheduleTime } = req.body;
    
    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }
    
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }
    
    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }
    
    if (invoice.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled invoices cannot be sent as proforma invoices.",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `📄 Proforma Invoice #${invoice.invoiceNumber}`,
      message: getProformaInvoiceHTML(invoice),
      scheduleTime: scheduledAt,
      emailType: "proforma",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    return res.status(201).json({
      success: true,
      message: "Proforma invoice scheduled successfully.",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Proforma Invoice Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// 11. Credit Note 💳
export const sendCreditNote = async (req, res) => {
  try {
    const { invoiceId, creditAmount, reason = "Discount / Refund", scheduleTime } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice id",
      });
    }

    if (creditAmount === undefined || isNaN(creditAmount) || Number(creditAmount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid credit amount is required.",
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.client?.email) {
      return res.status(400).json({
        success: false,
        message: "Client email not found",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot issue a credit note for a cancelled invoice.",
      });
    }

    if (Number(creditAmount) > Number(invoice.total)) {
      return res.status(400).json({
        success: false,
        message: "Credit amount cannot exceed invoice total.",
      });
    }

    // Check email limit
    const user = await User.findById(req.user._id);
    const canSend = await user.canSendEmail();
    
    if (!canSend) {
      return res.status(403).json({
        success: false,
        message: `Email limit exceeded. You have used ${user.subscription.limits.used} out of ${user.subscription.limits.monthly} emails.`,
        data: {
          plan: user.subscription.plan,
          limit: user.subscription.limits.monthly,
          used: user.subscription.limits.used,
          remaining: user.getRemainingEmails(),
        }
      });
    }

    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule time",
      });
    }

    const scheduledEmail = await ScheduledEmail.create({
      userId: req.user._id,
      toEmail: invoice.client.email,
      subject: `💳 Credit Note for Invoice #${invoice.invoiceNumber}`,
      message: getCreditNoteHTML(invoice, creditAmount, reason),
      scheduleTime: scheduledAt,
      emailType: "credit_note",
      invoiceId: invoice._id,
    });

    // Increment email count
    await user.incrementEmailCount();

    return res.status(201).json({
      success: true,
      message: "Credit note scheduled successfully.",
      data: scheduledEmail,
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
        plan: user.subscription.plan,
      }
    });
  } catch (error) {
    console.error("Credit Note Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong.",
    });
  }
};

// backend/src/controllers/emailController.js

// Get email stats summary
export const getEmailStatsSummary = async (req, res) => {
  try {
    const userId = req.user._id;
console.log("userId : " ,userId)
    // Get counts by status
    const totalEmails = await ScheduledEmail.countDocuments({ userId });
    const pendingEmails = await ScheduledEmail.countDocuments({ 
      userId, 
      status: 'pending' 
    });
    const sentEmails = await ScheduledEmail.countDocuments({ 
      userId, 
      status: 'sent' 
    });
    const failedEmails = await ScheduledEmail.countDocuments({ 
      userId, 
      status: 'failed' 
    });

    // Get counts by email type
    const emailTypeStats = await ScheduledEmail.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { 
        $group: { 
          _id: '$emailType', 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]);

    // Get monthly stats (last 12 months)
    const monthlyStats = await ScheduledEmail.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Get user subscription info for email limits
    const user = await User.findById(userId);
    
    // Calculate remaining emails
    const remaining = user.getRemainingEmails ? user.getRemainingEmails() : 
      Math.max(0, (user.subscription?.limits?.monthly || 5) - (user.subscription?.limits?.used || 0));

    res.json({
      success: true,
      data: {
        total: totalEmails,
        pending: pendingEmails,
        sent: sentEmails,
        failed: failedEmails,
        byType: emailTypeStats,
        monthly: monthlyStats,
        usage: {
          plan: user.subscription?.plan || 'free',
          limit: user.subscription?.limits?.monthly || 5,
          used: user.subscription?.limits?.used || 0,
          remaining: remaining,
          resetDate: user.subscription?.limits?.resetDate || new Date()
        }
      }
    });

  } catch (error) {
    console.error('Get Email Stats Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get email usage stats only (simpler version)
export const getEmailStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Calculate remaining emails
    const remaining = user.getRemainingEmails ? user.getRemainingEmails() : 
      Math.max(0, (user.subscription?.limits?.monthly || 5) - (user.subscription?.limits?.used || 0));

    const stats = {
      plan: user.subscription?.plan || 'free',
      limit: user.subscription?.limits?.monthly || 5,
      used: user.subscription?.limits?.used || 0,
      remaining: remaining,
      resetDate: user.subscription?.limits?.resetDate || new Date(),
      percentage: user.subscription?.limits?.monthly ? 
        Math.round((user.subscription.limits.used / user.subscription.limits.monthly) * 100) : 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get Email Stats Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// Get all scheduled emails with search, filters & pagination
export const getMyEmails = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      emailType = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { userId: req.user._id };

    // Search by email, subject, invoice number, or client name
    if (search) {
      query.$or = [
        { toEmail: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        // Search in populated invoice fields
        ...(mongoose.Types.ObjectId.isValid(search) 
          ? [{ invoiceId: new mongoose.Types.ObjectId(search) }] 
          : [])
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by email type
    if (emailType) {
      query.emailType = emailType;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.scheduleTime = {};
      if (startDate) {
        query.scheduleTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.scheduleTime.$lte = new Date(endDate);
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [emails, totalCount] = await Promise.all([
      ScheduledEmail.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: 'invoiceId',
          select: 'invoiceNumber clientName clientEmail total status dueDate'
        })
        .lean(),
      ScheduledEmail.countDocuments(query)
    ]);

    // Get email stats
    const user = await User.findById(req.user._id);
    const stats = {
      plan: user.subscription.plan,
      limit: user.subscription.limits.monthly,
      used: user.subscription.limits.used,
      remaining: user.getRemainingEmails(),
      resetDate: user.subscription.limits.resetDate,
    };

    res.json({
      success: true,
      data: emails,
      stats: stats,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNext: parseInt(page) * limitNum < totalCount,
        hasPrev: parseInt(page) > 1
      },
      filters: {
        status,
        emailType,
        search,
        startDate,
        endDate,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Get My Emails Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get email by ID (for details view)
export const getEmailById = async (req, res) => {
  try {
    const email = await ScheduledEmail.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('invoiceId');

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      });
    }

    res.json({
      success: true,
      data: email
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get email stats summary
// export const getEmailStatsSummary = async (req, res) => {
//   try {
//     const totalEmails = await ScheduledEmail.countDocuments({ userId: req.user._id });
//     const pendingEmails = await ScheduledEmail.countDocuments({ 
//       userId: req.user._id, 
//       status: 'pending' 
//     });
//     const sentEmails = await ScheduledEmail.countDocuments({ 
//       userId: req.user._id, 
//       status: 'sent' 
//     });
//     const failedEmails = await ScheduledEmail.countDocuments({ 
//       userId: req.user._id, 
//       status: 'failed' 
//     });

//     // Group by email type
//     const emailTypeStats = await ScheduledEmail.aggregate([
//       { $match: { userId: req.user._id } },
//       { $group: { _id: '$emailType', count: { $sum: 1 } } },
//       { $sort: { count: -1 } }
//     ]);

//     // Group by month
//     const monthlyStats = await ScheduledEmail.aggregate([
//       { $match: { userId: req.user._id } },
//       {
//         $group: {
//           _id: {
//             year: { $year: '$createdAt' },
//             month: { $month: '$createdAt' }
//           },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { '_id.year': -1, '_id.month': -1 } },
//       { $limit: 12 }
//     ]);

//     const user = await User.findById(req.user._id);

//     res.json({
//       success: true,
//       data: {
//         total: totalEmails,
//         pending: pendingEmails,
//         sent: sentEmails,
//         failed: failedEmails,
//         byType: emailTypeStats,
//         monthly: monthlyStats,
//         usage: {
//           plan: user.subscription.plan,
//           limit: user.subscription.limits.monthly,
//           used: user.subscription.limits.used,
//           remaining: user.getRemainingEmails(),
//           resetDate: user.subscription.limits.resetDate,
//         }
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// Delete scheduled email
export const deleteEmail = async (req, res) => {
  try {
    const email = await ScheduledEmail.findOne({
      _id: req.params.id,
      userId: req.user._id,
      status: 'pending'
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found or already sent'
      });
    }

    await email.deleteOne();

    // Get updated stats
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      message: 'Email deleted successfully',
      emailStats: {
        remaining: user.getRemainingEmails(),
        used: user.subscription.limits.used,
        limit: user.subscription.limits.monthly,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get email usage stats
// export const getEmailStats = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id);
    
//     const stats = {
//       plan: user.subscription.plan,
//       limit: user.subscription.limits.monthly,
//       used: user.subscription.limits.used,
//       remaining: user.getRemainingEmails(),
//       resetDate: user.subscription.limits.resetDate,
//       percentage: Math.round((user.subscription.limits.used / user.subscription.limits.monthly) * 100),
//     };

//     res.json({
//       success: true,
//       data: stats,
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };