import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
  },
  client: {
    name: {
      type: String,
      required: true,
    },
    email: String,
    phone: String,
    address: String,
    gst: String,
  },
  items: [{
    description: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
    },
  }],
  subtotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  discount: Number,
  total: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: '₹'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
  },
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  notes: String,
  terms: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-generate unique invoice number
invoiceSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  
  try {
    // Get the current year and month for prefix
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Find the last invoice to get the sequence number
    const lastInvoice = await mongoose.model('Invoice')
      .findOne({})
      .sort({ createdAt: -1 })
      .select('invoiceNumber');
    
    let sequence = 1;
    
    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract sequence number from last invoice
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length === 3) {
        sequence = parseInt(parts[2]) + 1;
      }
    }
    
    // Generate unique invoice number: INV-YYMM-XXXXX
    this.invoiceNumber = `INV-${year}${month}-${String(sequence).padStart(5, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model('Invoice', invoiceSchema);


