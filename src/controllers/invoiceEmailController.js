import Invoice from "../models/Invoice.js";

// Create Invoice
export const createInvoice = async (req, res) => {
  try {
    console.log(req.user?._id);
    const invoiceData = {
      ...req.body,
      userId: req.user._id
    };

    // Calculate totals if not provided
    if (!invoiceData.subtotal) {
      const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.total || 0), 0);
      const discountAmount = (subtotal * (invoiceData.discount || 0)) / 100;
      const taxAmount = ((subtotal - discountAmount) * (invoiceData.tax || 0)) / 100;
      invoiceData.subtotal = subtotal;
      invoiceData.total = subtotal - discountAmount + taxAmount;
    }

    const invoice = await Invoice.create(invoiceData);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get My Invoices
export const getMyInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: invoices
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Invoice by ID
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: invoice
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};  

// Update Invoice
export const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    Object.assign(invoice, req.body);
    await invoice.save();

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Invoice
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await invoice.deleteOne();

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};