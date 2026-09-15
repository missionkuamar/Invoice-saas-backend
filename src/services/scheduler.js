import cron from 'node-cron';
import { ScheduledEmail } from '../models/ScheduledEmail.js';
import sendMail from '../config/sendmail.js';

export const startScheduler = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      console.log('⏰ Checking scheduled emails...');
      
      const now = new Date();
      const pendingEmails = await ScheduledEmail.find({
        scheduleTime: { $lte: now },
        status: 'pending'
      });

      if (pendingEmails.length === 0) {
        console.log('📭 No emails to send');
        return;
      }

      console.log(`📧 Sending ${pendingEmails.length} emails`);

      for (const email of pendingEmails) {
        try {
          const sent = await sendMail({
            to: email.toEmail,
            subject: email.subject,
            html: `
              <h3>${email.subject}</h3>
              <p>${email.message}</p>
              <hr>
              <p><small>Sent via Email Scheduler App</small></p>
            `
          });

          if (sent) {
            email.status = 'sent';
            email.sentAt = new Date();
            await email.save();
            console.log(`✅ Email sent to ${email.toEmail}`);
          } else {
            email.status = 'failed';
            await email.save();
            console.log(`❌ Failed to send to ${email.toEmail}`);
          }

        } catch (error) {
          email.status = 'failed';
          await email.save();
          console.error(`❌ Error sending to ${email.toEmail}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Scheduler error:', error.message);
    }
  });
};