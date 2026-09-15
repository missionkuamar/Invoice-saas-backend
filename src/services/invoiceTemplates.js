// All invoice email templates

// 1. Send Invoice to Client 💰
export const getInvoiceEmailHTML = (invoice) => {
  const currency = invoice.currency || "₹";

  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax || 0);
  const discount = Number(invoice.discount || 0);
  const total = Number(invoice.total || 0);

  const issueDate = invoice.issueDate
    ? new Date(invoice.issueDate).toLocaleDateString()
    : "-";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString()
    : "-";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
background:#f5f5f5;
margin:0;
padding:20px;
}

.container{
max-width:850px;
margin:auto;
background:#fff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#1a237e;
padding:30px;
text-align:center;
color:#fff;
}

.header h1{
margin:0;
font-size:30px;
}

.content{
padding:30px;
}

.info{
display:flex;
justify-content:space-between;
margin-bottom:25px;
}

table{
width:100%;
border-collapse:collapse;
margin-top:20px;
}

th{
background:#f2f2f2;
padding:12px;
text-align:left;
}

td{
padding:12px;
border-bottom:1px solid #eee;
}

.total{
font-size:20px;
font-weight:bold;
}

.footer{
margin-top:30px;
padding:20px;
background:#fafafa;
text-align:center;
font-size:12px;
color:#777;
border-top:1px solid #eee;
}

.badge{
padding:5px 12px;
border-radius:20px;
font-size:12px;
font-weight:bold;
}

.paid{
background:#d4edda;
color:#155724;
}

.sent{
background:#fff3cd;
color:#856404;
}

.overdue{
background:#f8d7da;
color:#721c24;
}

.draft{
background:#e2e3e5;
color:#383d41;
}

.btn{
display:inline-block;
padding:12px 25px;
margin:10px 5px;
background:#1a237e;
color:#fff;
text-decoration:none;
border-radius:6px;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h1>Invoice</h1>

<p>${invoice.invoiceNumber}</p>

</div>

<div class="content">

<div class="info">

<div>

<h3>Bill To</h3>

<p><strong>${invoice.client?.name || "-"}</strong></p>

<p>${invoice.client?.email || ""}</p>

<p>${invoice.client?.phone || ""}</p>

<p>${invoice.client?.address || ""}</p>

${
  invoice.client?.gst
    ? `<p><strong>GST :</strong> ${invoice.client.gst}</p>`
    : ""
}

</div>

<div style="text-align:right">

<p><strong>Issue Date :</strong> ${issueDate}</p>

<p><strong>Due Date :</strong> ${dueDate}</p>

<p>

<strong>Status :</strong>

<span class="badge ${invoice.status}">

${invoice.status.toUpperCase()}

</span>

</p>

</div>

</div>

<table>

<thead>

<tr>

<th>Description</th>

<th>Qty</th>

<th>Rate</th>

<th>Amount</th>

</tr>

</thead>

<tbody>

${invoice.items
  .map(
    (item) => `
<tr>

<td>${item.description}</td>

<td>${item.quantity}</td>

<td>${currency} ${Number(item.rate).toFixed(2)}</td>

<td>${currency} ${Number(item.amount).toFixed(2)}</td>

</tr>
`
  )
  .join("")}

<tr>

<td colspan="3" align="right"><strong>Subtotal</strong></td>

<td>${currency} ${subtotal.toFixed(2)}</td>

</tr>

${
  discount > 0
    ? `
<tr>

<td colspan="3" align="right"><strong>Discount</strong></td>

<td>${currency} ${discount.toFixed(2)}</td>

</tr>
`
    : ""
}

${
  tax > 0
    ? `
<tr>

<td colspan="3" align="right"><strong>Tax</strong></td>

<td>${currency} ${tax.toFixed(2)}</td>

</tr>
`
    : ""
}

<tr class="total">

<td colspan="3" align="right">

Total

</td>

<td>

${currency} ${total.toFixed(2)}

</td>

</tr>

</tbody>

</table>

${
  invoice.notes
    ? `
<h3>Notes</h3>

<p>${invoice.notes}</p>
`
    : ""
}

${
  invoice.terms
    ? `
<h3>Terms & Conditions</h3>

<p>${invoice.terms}</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn">

View Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn"
style="background:#28a745;">

Download PDF

</a>

</div>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This email was generated automatically.

</p>

</div>

</div>

</body>

</html>
`;
};

// 2. Payment Reminder ⏰
export const getReminderEmailHTML = (invoice, daysLeft) => {
  const currency = invoice.currency || "₹";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString()
    : "-";

  const isOverdue = daysLeft < 0;

  return `
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
background:#f5f5f5;
margin:0;
padding:20px;
}

.container{
max-width:650px;
margin:auto;
background:#ffffff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:${isOverdue ? "#dc3545" : "#ffc107"};
padding:25px;
text-align:center;
color:${isOverdue ? "#fff" : "#000"};
}

.content{
padding:30px;
}

.box{
background:${isOverdue ? "#f8d7da" : "#fff3cd"};
border-left:5px solid ${isOverdue ? "#dc3545" : "#ffc107"};
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:20px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
background:#1a237e;
color:#ffffff;
padding:12px 25px;
text-decoration:none;
border-radius:6px;
margin:8px;
}

.footer{
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
margin-top:30px;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>

${isOverdue ? "⚠️ Payment Overdue" : "⏰ Payment Reminder"}

</h2>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

${
  isOverdue
    ? `Your invoice <strong>#${invoice.invoiceNumber}</strong> is now overdue. Kindly complete the payment as soon as possible.`
    : `This is a friendly reminder that your invoice <strong>#${invoice.invoiceNumber}</strong> is due soon.`
}

</p>

<div class="box">

<table>

<tr>

<td><strong>Invoice Number</strong></td>

<td>${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Amount Due</strong></td>

<td>${currency} ${Number(invoice.total).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Due Date</strong></td>

<td>${dueDate}</td>

</tr>

<tr>

<td><strong>Status</strong></td>

<td>${invoice.status.toUpperCase()}</td>

</tr>

<tr>

<td><strong>${
  isOverdue ? "Overdue By" : "Days Left"
}</strong></td>

<td>${Math.abs(daysLeft)} Day${Math.abs(daysLeft) !== 1 ? "s" : ""}</td>

</tr>

</table>

</div>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn">

👁 View Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn"
style="background:#28a745;">

📄 Download PDF

</a>

${
  invoice.status !== "paid"
    ? `
<a
href="${process.env.FRONTEND_URL}/pay/${invoice._id}"
class="btn"
style="background:#ff6f00;">

💳 Pay Now

</a>
`
    : ""
}

</div>

<p>

If you have already completed the payment, please ignore this reminder.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automated payment reminder.

</p>

</div>

</div>

</body>

</html>
`;
};

// 3. Overdue Payment Alert 🚨
export const getOverdueEmailHTML = (invoice, daysOverdue) => {
  const currency = invoice.currency || "₹";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString()
    : "-";

  const lateFee =
    daysOverdue > 15
      ? (Number(invoice.total) * 0.05).toFixed(2)
      : null;

  return `
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
background:#f5f5f5;
margin:0;
padding:20px;
}

.container{
max-width:650px;
margin:auto;
background:#ffffff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#dc3545;
color:#fff;
padding:25px;
text-align:center;
}

.content{
padding:30px;
}

.alert{
background:#f8d7da;
border-left:5px solid #dc3545;
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:15px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
text-decoration:none;
border-radius:6px;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.btn-pay{
background:#dc3545;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>🚨 OVERDUE PAYMENT ALERT</h2>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

Your invoice
<strong>#${invoice.invoiceNumber}</strong>
is now
<strong>${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue</strong>.

</p>

<div class="alert">

<h3>⚠️ Immediate Action Required</h3>

<table>

<tr>

<td><strong>Invoice Number</strong></td>

<td>${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Amount Due</strong></td>

<td>${currency} ${Number(invoice.total).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Due Date</strong></td>

<td>${dueDate}</td>

</tr>

<tr>

<td><strong>Status</strong></td>

<td>${invoice.status.toUpperCase()}</td>

</tr>

<tr>

<td><strong>Days Overdue</strong></td>

<td>${daysOverdue}</td>

</tr>

${
  lateFee
    ? `
<tr>

<td><strong>Late Fee (5%)</strong></td>

<td>${currency} ${lateFee}</td>

</tr>
`
    : ""
}

</table>

</div>

<p>

Please complete the payment immediately to avoid additional late fees and service interruptions.

</p>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn btn-view">

👁 View Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download PDF

</a>

${
  invoice.status !== "paid"
    ? `
<a
href="${process.env.FRONTEND_URL}/pay/${invoice._id}"
class="btn btn-pay">

💳 Pay Now

</a>
`
    : ""
}

</div>

<p>

If you have already made the payment, kindly ignore this email. For any questions, please contact our support team.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automated overdue payment notification.

</p>

</div>

</div>

</body>

</html>
`;
};

// 4. Payment Confirmation ✅
export const getPaymentConfirmationHTML = (
  invoice,
  paymentDetails = {}
) => {
  const currency = invoice.currency || "₹";

  const paymentDate = paymentDetails.date
    ? new Date(paymentDetails.date).toLocaleDateString()
    : new Date().toLocaleDateString();

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
background:#f5f5f5;
margin:0;
padding:20px;
}

.container{
max-width:650px;
margin:auto;
background:#ffffff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#28a745;
color:#fff;
padding:25px;
text-align:center;
}

.content{
padding:30px;
}

.success{
background:#d4edda;
border-left:5px solid #28a745;
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:15px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
border-radius:6px;
text-decoration:none;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>✅ Payment Confirmed</h2>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

We have successfully received your payment for Invoice
<strong>#${invoice.invoiceNumber}</strong>.

Thank you for your business.

</p>

<div class="success">

<h3 style="color:#155724">

🎉 Payment Received Successfully

</h3>

<table>

<tr>

<td><strong>Invoice Number</strong></td>

<td>${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Amount Paid</strong></td>

<td>${currency} ${Number(invoice.total).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Payment Date</strong></td>

<td>${paymentDate}</td>

</tr>

<tr>

<td><strong>Transaction ID</strong></td>

<td>${paymentDetails.transactionId || "-"}</td>

</tr>

<tr>

<td><strong>Payment Method</strong></td>

<td>${paymentDetails.method || "-"}</td>

</tr>

<tr>

<td><strong>Status</strong></td>

<td><strong style="color:#28a745;">PAID</strong></td>

</tr>

</table>

</div>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn btn-view">

👁 View Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download Receipt

</a>

</div>

<p>

We appreciate your prompt payment.
If you have any questions, feel free to contact us.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automated payment confirmation email.

</p>

</div>

</div>

</body>

</html>
`;
};

// 5. Invoice Cancellation ❌
export const getCancellationEmailHTML = (
  invoice,
  reason = "Requested by client"
) => {
  const currency = invoice.currency || "₹";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString()
    : "-";

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
background:#f5f5f5;
margin:0;
padding:20px;
}

.container{
max-width:650px;
margin:auto;
background:#ffffff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#dc3545;
color:#ffffff;
padding:25px;
text-align:center;
}

.content{
padding:30px;
}

.info-box{
background:#f8f9fa;
border-left:5px solid #dc3545;
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:15px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
border-radius:6px;
text-decoration:none;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>❌ Invoice Cancelled</h2>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

This email confirms that Invoice
<strong>#${invoice.invoiceNumber}</strong>
has been cancelled.

</p>

<div class="info-box">

<table>

<tr>

<td><strong>Invoice Number</strong></td>

<td>${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Invoice Amount</strong></td>

<td>${currency} ${Number(invoice.total).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Due Date</strong></td>

<td>${dueDate}</td>

</tr>

<tr>

<td><strong>Status</strong></td>

<td><strong style="color:#dc3545;">CANCELLED</strong></td>

</tr>

<tr>

<td><strong>Reason</strong></td>

<td>${reason}</td>

</tr>

</table>

</div>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn btn-view">

👁 View Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download PDF

</a>

</div>

<p>

If you believe this cancellation was made in error or have any questions,
please contact our support team.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automated cancellation notification.

</p>

</div>

</div>

</body>

</html>
`;
};

// 6. Invoice Updated/Revised 📝
export const getRevisedEmailHTML = (
  invoice,
  changes = []
) => {

    console.log("Raw Changes:", changes);

  // Convert to array if needed
  if (!Array.isArray(changes)) {
    changes = changes ? [changes] : [];
  }

  console.log("Normalized Changes:", changes);
  
  const currency = invoice.currency || "₹";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString()
    : "-";

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
background:#f5f5f5;
margin:0;
padding:20px;
}

.container{
max-width:650px;
margin:auto;
background:#ffffff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#17a2b8;
color:#ffffff;
padding:25px;
text-align:center;
}

.content{
padding:30px;
}

.changes-box{
background:#e3f2fd;
border-left:5px solid #17a2b8;
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:15px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
border-radius:6px;
text-decoration:none;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

ul{
padding-left:20px;
}

li{
margin-bottom:8px;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>📝 Revised Invoice</h2>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

Your invoice
<strong>#${invoice.invoiceNumber}</strong>
has been updated.

Please review the revised details below.

</p>

<div class="changes-box">

<h3>Changes Made</h3>

${
  changes.length
    ? `
<ul>

${changes.map(change => `<li>${change}</li>`).join("")}

</ul>
`
    : `
<p>No specific changes were provided.</p>
`
}

<table>

<tr>

<td><strong>Invoice Number</strong></td>

<td>${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Updated Total</strong></td>

<td>${currency} ${Number(invoice.total).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Due Date</strong></td>

<td>${dueDate}</td>

</tr>

<tr>

<td><strong>Status</strong></td>

<td>${invoice.status.toUpperCase()}</td>

</tr>

</table>

</div>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn btn-view">

👁 View Revised Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download PDF

</a>

</div>

<p>

If you have any questions regarding these revisions,
please contact our support team.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automated revised invoice notification.

</p>

</div>

</div>

</body>

</html>
`;
};

// 7. Bulk Invoice to Multiple Clients 📨 (Used in loop)
export const getBulkInvoiceEmailHTML = (invoice) => {
  return getInvoiceEmailHTML(invoice);
};

// 8. Recurring Invoice 🔄
export const getRecurringInvoiceHTML = (
  invoice,
  cycle = "Monthly"
) => {
  const currency = invoice.currency || "₹";

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate)
    : null;

  const formattedDueDate = dueDate
    ? dueDate.toLocaleDateString()
    : "-";

  // Calculate next recurring date
  const nextInvoiceDate = dueDate ? new Date(dueDate) : null;

  if (nextInvoiceDate) {
    switch (cycle.toLowerCase()) {
      case "daily":
        nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 1);
        break;

      case "weekly":
        nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 7);
        break;

      case "monthly":
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
        break;

      case "quarterly":
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 3);
        break;

      case "yearly":
        nextInvoiceDate.setFullYear(nextInvoiceDate.getFullYear() + 1);
        break;

      default:
        break;
    }
  }

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
margin:0;
padding:20px;
background:#f5f5f5;
}

.container{
max-width:650px;
margin:auto;
background:#fff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#6f42c1;
color:#fff;
padding:25px;
text-align:center;
}

.content{
padding:30px;
}

.info-box{
background:#f3e8ff;
border-left:5px solid #6f42c1;
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:10px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
border-radius:6px;
text-decoration:none;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>🔄 Recurring Invoice</h2>

<p>Invoice #${invoice.invoiceNumber}</p>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

Your <strong>${cycle}</strong> recurring invoice is now available.

Please review the details below.

</p>

<div class="info-box">

<table>

<tr>

<td><strong>Invoice Number</strong></td>

<td>${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Billing Cycle</strong></td>

<td>${cycle}</td>

</tr>

<tr>

<td><strong>Total Amount</strong></td>

<td>${currency} ${Number(invoice.total).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Due Date</strong></td>

<td>${formattedDueDate}</td>

</tr>

<tr>

<td><strong>Next Invoice Date</strong></td>

<td>${
  nextInvoiceDate
    ? nextInvoiceDate.toLocaleDateString()
    : "-"
}</td>

</tr>

<tr>

<td><strong>Status</strong></td>

<td>${invoice.status.toUpperCase()}</td>

</tr>

</table>

</div>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn btn-view">

👁 View Invoice

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download PDF

</a>

</div>

<p>

Thank you for your continued business. If you have any questions regarding this recurring invoice, please contact us.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automated recurring invoice notification.

</p>

</div>

</div>

</body>

</html>
`;
};

// 9. Proforma Invoice 📄
export const getProformaInvoiceHTML = (invoice) => {
  const currency = invoice.currency || "₹";

  const issueDate = invoice.issueDate
    ? new Date(invoice.issueDate).toLocaleDateString()
    : "-";

  const validUntil = invoice.issueDate
    ? new Date(
        new Date(invoice.issueDate).setDate(
          new Date(invoice.issueDate).getDate() + 15
        )
      ).toLocaleDateString()
    : "-";

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
margin:0;
padding:20px;
background:#f5f5f5;
}

.container{
max-width:800px;
margin:auto;
background:#fff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#2196f3;
color:#fff;
padding:25px;
text-align:center;
}

.badge{
display:inline-block;
margin-top:10px;
padding:6px 18px;
background:#fff;
color:#2196f3;
border-radius:20px;
font-weight:bold;
}

.content{
padding:30px;
}

table{
width:100%;
border-collapse:collapse;
margin-top:20px;
}

th{
background:#f5f5f5;
padding:12px;
text-align:left;
}

td{
padding:12px;
border-bottom:1px solid #eee;
}

.total-row{
font-weight:bold;
font-size:16px;
background:#f9f9f9;
}

.note-box{
background:#fff3cd;
border-left:5px solid #ffc107;
padding:15px;
margin-top:25px;
border-radius:6px;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
border-radius:6px;
text-decoration:none;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>📄 Proforma Invoice</h2>

<p>#${invoice.invoiceNumber}</p>

<span class="badge">

PROFORMA • NOT A TAX INVOICE

</span>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

Please review your proforma invoice below.

</p>

<table>

<thead>

<tr>

<th>Description</th>

<th>Qty</th>

<th>Rate</th>

<th>Amount</th>

</tr>

</thead>

<tbody>

${invoice.items
  .map(
    (item) => `
<tr>

<td>${item.description}</td>

<td>${item.quantity}</td>

<td>${currency} ${Number(item.rate).toFixed(2)}</td>

<td>${currency} ${Number(item.amount).toFixed(2)}</td>

</tr>
`
  )
  .join("")}

<tr class="total-row">

<td colspan="3" style="text-align:right;">

Subtotal

</td>

<td>

${currency} ${Number(invoice.subtotal || 0).toFixed(2)}

</td>

</tr>

${
  invoice.tax
    ? `
<tr>

<td colspan="3" style="text-align:right;">

Tax

</td>

<td>

${currency} ${Number(invoice.tax).toFixed(2)}

</td>

</tr>
`
    : ""
}

${
  invoice.discount
    ? `
<tr>

<td colspan="3" style="text-align:right;">

Discount

</td>

<td>

- ${currency} ${Number(invoice.discount).toFixed(2)}

</td>

</tr>
`
    : ""
}

<tr class="total-row">

<td colspan="3" style="text-align:right;">

Grand Total

</td>

<td style="color:#2196f3;">

${currency} ${Number(invoice.total).toFixed(2)}

</td>

</tr>

</tbody>

</table>

<p>

<strong>Issue Date:</strong> ${issueDate}

</p>

<p>

<strong>Valid Until:</strong> ${validUntil}

</p>

${
  invoice.terms
    ? `
<p>

<strong>Terms & Conditions:</strong><br>

${invoice.terms}

</p>
`
    : `
<p>

<strong>Terms:</strong> Payment is required before delivery.

</p>
`
}

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div class="note-box">

<strong>⚠️ Important</strong>

<p>

This is a Proforma Invoice and is not a Tax Invoice.
A final tax invoice will be issued after payment is received.

</p>

</div>

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/invoice/${invoice._id}"
class="btn btn-view">

👁 View Proforma

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download PDF

</a>

</div>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automatically generated Proforma Invoice.

</p>

</div>

</div>

</body>

</html>
`;
};

// 10. Credit Note 💳
export const getCreditNoteHTML = (
  invoice,
  creditAmount,
  reason = "Discount / Refund"
) => {
  const currency = invoice.currency || "₹";

  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + 3);

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

body{
font-family:Arial,sans-serif;
margin:0;
padding:20px;
background:#f5f5f5;
}

.container{
max-width:650px;
margin:auto;
background:#fff;
border-radius:10px;
overflow:hidden;
box-shadow:0 2px 10px rgba(0,0,0,.08);
}

.header{
background:#17a2b8;
color:#fff;
padding:25px;
text-align:center;
}

.content{
padding:30px;
}

.credit-box{
background:#d1ecf1;
border-left:5px solid #17a2b8;
padding:20px;
border-radius:6px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:10px;
}

td{
padding:10px;
border-bottom:1px solid #eee;
}

.btn{
display:inline-block;
padding:12px 24px;
margin:8px;
border-radius:6px;
text-decoration:none;
font-weight:bold;
color:#fff;
}

.btn-view{
background:#1a237e;
}

.btn-download{
background:#28a745;
}

.footer{
margin-top:30px;
padding:20px;
text-align:center;
font-size:12px;
color:#666;
border-top:1px solid #eee;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h2>💳 Credit Note</h2>

<p>Credit Note #CN-${invoice.invoiceNumber}</p>

</div>

<div class="content">

<p>

Dear <strong>${invoice.client?.name || "Customer"}</strong>,

</p>

<p>

A Credit Note has been issued against Invoice
<strong>#${invoice.invoiceNumber}</strong>.

</p>

<div class="credit-box">

<table>

<tr>

<td><strong>Original Invoice</strong></td>

<td>#${invoice.invoiceNumber}</td>

</tr>

<tr>

<td><strong>Credit Amount</strong></td>

<td>${currency} ${Number(creditAmount).toFixed(2)}</td>

</tr>

<tr>

<td><strong>Reason</strong></td>

<td>${reason}</td>

</tr>

<tr>

<td><strong>Valid Until</strong></td>

<td>${validUntil.toLocaleDateString()}</td>

</tr>

</table>

</div>

${
  invoice.notes
    ? `
<p>

<strong>Notes:</strong><br>

${invoice.notes}

</p>
`
    : ""
}

<div style="text-align:center;margin-top:30px;">

<a
href="${process.env.FRONTEND_URL}/credit/${invoice._id}"
class="btn btn-view">

💳 View Credit Note

</a>

<a
href="${process.env.BACKEND_URL}/api/invoices/${invoice._id}/download"
class="btn btn-download">

📄 Download Invoice

</a>

</div>

<p>

This credit may be applied toward future purchases in accordance with our terms.

</p>

</div>

<div class="footer">

<p>

© ${new Date().getFullYear()} Your Company

</p>

<p>

This is an automatically generated Credit Note.

</p>

</div>

</div>

</body>

</html>
`;
};