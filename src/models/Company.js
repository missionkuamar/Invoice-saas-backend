import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  companyName: {
    type: String,
    default: '',
  },
  companyEmail: {
    type: String,
    default: '',
  },
  companyPhone: {
    type: String,
    default: '',
  },
  companyAddress: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: 'India' },
  },
  gstNumber: {
    type: String,
    default: '',
  },
  panNumber: {
    type: String,
    default: '',
  },
  logo: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
  },
  taxSettings: {
    defaultTaxRate: {
      type: Number,
      default: 18,
    },
    taxTypes: [{
      name: {
        type: String,
        required: true,
      },
      rate: {
        type: Number,
        required: true,
      },
      description: {
        type: String,
        default: '',
      },
      isDefault: {
        type: Boolean,
        default: false,
      },
    }],
    calculateTaxOn: {
      type: String,
      enum: ['subtotal', 'total'],
      default: 'subtotal',
    },
    roundTax: {
      type: Boolean,
      default: true,
    },
  },
  currency: {
    type: String,
    default: 'INR',
  },
  theme: {
    primaryColor: {
      type: String,
      default: '#0ea5e9',
    },
    secondaryColor: {
      type: String,
      default: '#1e293b',
    },
    fontFamily: {
      type: String,
      default: 'Inter, sans-serif',
    },
  },
  invoiceSettings: {
    prefix: {
      type: String,
      default: 'INV',
    },
    numberFormat: {
      type: String,
      default: 'YYYYMM-XXXXX',
    },
    showLogo: {
      type: Boolean,
      default: true,
    },
    showGST: {
      type: Boolean,
      default: true,
    },
    showBankDetails: {
      type: Boolean,
      default: false,
    },
    footerText: {
      type: String,
      default: 'Thank you for your business!',
    },
    termsText: {
      type: String,
      default: 'Payment due within 30 days.',
    },
  },
  bankDetails: {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    accountHolder: { type: String, default: '' },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

companySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Company', companySchema);