import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const generateInvoicePDF = async (invoice) => {
  let browser;

  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { background: #1a237e; color: white; padding: 20px; text-align: center; }
          .header h1 { margin: 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f5f5f5; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .total { font-size: 24px; font-weight: bold; text-align: right; color: #1a237e; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INVOICE</h1>
          <p>#${invoice.invoiceNumber}</p>
        </div>
        <h3>Client: ${invoice.clientName}</h3>
        <p>Email: ${invoice.clientEmail}</p>
        <p>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        <table>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
          ${invoice.items.map(item => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td>${item.description || '-'}</td>
              <td>${item.quantity}</td>
              <td>${invoice.currency} ${item.price}</td>
              <td>${invoice.currency} ${item.total}</td>
            </tr>
          `).join('')}
          <tr>
            <td colspan="4" style="text-align: right;"><strong>Total</strong></td>
            <td><strong>${invoice.currency} ${invoice.total}</strong></td>
          </tr>
        </table>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Your Company</p>
        </div>
      </body>
      </html>
    `;

    // ✅ FIX 1: userDataDir set kiya (EBUSY error solve)
    // ✅ FIX 2: timeout badhaya
    // ✅ FIX 3: no-sandbox flags
    browser = await puppeteer.launch({
      headless: true,
      timeout: 60000, // 60 second
      userDataDir: path.join(process.cwd(), '.puppeteer-profile'),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const pdfPath = path.join(uploadDir, `invoice-${invoice.invoiceNumber}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });

    return pdfPath;

  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;

  } finally {
    // ✅ FIX 4: Error aaye ya na aaye, browser zaroor band hoga
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn('Browser close warning:', closeErr.message);
      }
    }
  }
};