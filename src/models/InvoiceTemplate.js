import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['simple', 'modern', 'corporate', 'creative', 'minimal', 'elegant'],
    default: 'simple',
  },
  description: String,
  style: {
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
    headerStyle: {
      type: String,
      enum: ['centered', 'left', 'right'],
      default: 'left',
    },
    showLogo: {
      type: Boolean,
      default: true,
    },
    showFooter: {
      type: Boolean,
      default: true,
    },
    showTerms: {
      type: Boolean,
      default: true,
    },
  },
  sections: {
    header: {
      enabled: { type: Boolean, default: true },
      fields: [String],
    },
    client: {
      enabled: { type: Boolean, default: true },
      fields: [String],
    },
    items: {
      enabled: { type: Boolean, default: true },
      fields: [String],
    },
    summary: {
      enabled: { type: Boolean, default: true },
      fields: [String],
    },
    footer: {
      enabled: { type: Boolean, default: true },
      fields: [String],
    },
  },
  layout: {
    type: String,
    enum: ['standard', 'compact', 'detailed', 'minimal'],
    default: 'standard',
  },
  preview: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('InvoiceTemplate', templateSchema);