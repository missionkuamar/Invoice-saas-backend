import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import { generateInvoiceNumber } from '../utils/invoiceNumberGenerator.js';

// @desc    Create invoice
// @route   POST /api/invoices
export const createInvoice = async (req, res) => {
  try {
    const { client, items, dueDate, notes, terms, status } = req.body;

    // Check subscription limits
    const user = await User.findById(req.user._id);
    const invoiceCount = await Invoice.countDocuments({ user: req.user._id });

   let maxInvoices = 10; // Free

if (user.subscription?.plan === 'basic')
  maxInvoices = 100;

else if (user.subscription?.plan === 'starter')
  maxInvoices = 200;

else if (user.subscription?.plan === 'pro')
  maxInvoices = 500;

else if (user.subscription?.plan === 'enterprise')
  maxInvoices = Infinity;

    if (invoiceCount >= maxInvoices) {
      return res.status(403).json({
        success: false,
        message: `Your ${user.subscription?.plan || 'free'} plan allows only ${maxInvoices} invoices. Please upgrade.`,
      });
    }

    // Calculate amounts
    let subtotal = 0;
    const itemsWithAmount = items.map(item => {
      const amount = item.quantity * item.rate;
      subtotal += amount;
      return { ...item, amount };
    });

    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice with generated number
    const invoiceData = {
      user: req.user._id,
      invoiceNumber,
      client,
      items: itemsWithAmount,
      subtotal,
      tax,
      total,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      notes,
      terms,
      status: status || 'draft',
    };

    // If issueDate is provided, use it
    if (req.body.issueDate) {
      invoiceData.issueDate = req.body.issueDate;
    }

    const invoice = await Invoice.create(invoiceData);

    res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
 //   console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ... rest of the controller functions remain the same
// @desc    Get all invoices with advanced filters and pagination
// @route   GET /api/invoices
export const getInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      clientName,
      clientEmail,
      invoiceNumber,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { user: req.user._id };

    // Advanced search - search by invoice number, client name, or email
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'client.name': { $regex: search, $options: 'i' } },
        { 'client.email': { $regex: search, $options: 'i' } },
      ];
    }

    // Individual filters (override search if specific filters are used)
    if (invoiceNumber) {
      query.invoiceNumber = { $regex: invoiceNumber, $options: 'i' };
    }
    
    if (clientName) {
      query['client.name'] = { $regex: clientName, $options: 'i' };
    }
    
    if (clientEmail) {
      query['client.email'] = { $regex: clientEmail, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) {
        query.issueDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.issueDate.$lte = new Date(endDate);
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      query.total = {};
      if (minAmount) query.total.$gte = Number(minAmount);
      if (maxAmount) query.total.$lte = Number(maxAmount);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute queries
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Invoice.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
        filters: req.query,
      },
    });
  } catch (error) {
   // console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
export const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
export const updateInvoice = async (req, res) => {
  try {
    let invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // Don't allow editing paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a paid invoice',
      });
    }

    const { client, items, dueDate, notes, terms, status } = req.body;

    // Recalculate amounts if items changed
    if (items) {
      let subtotal = 0;
      const itemsWithAmount = items.map(item => {
        const amount = item.quantity * item.rate;
        subtotal += amount;
        return { ...item, amount };
      });
      const tax = subtotal * 0.18;
      const total = subtotal + tax;
      req.body.items = itemsWithAmount;
      req.body.subtotal = subtotal;
      req.body.tax = tax;
      req.body.total = total;
    }

    invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a paid invoice',
      });
    }

    await invoice.remove();

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};