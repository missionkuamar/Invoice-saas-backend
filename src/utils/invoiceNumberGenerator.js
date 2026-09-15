// src/utils/invoiceNumberGenerator.js
import mongoose from 'mongoose';

/**
 * Generate a unique invoice number
 * Format: INV-YYYYMM-XXXXX
 * Example: INV-202401-00001
 */
export const generateInvoiceNumber = async () => {
  const Invoice = mongoose.model('Invoice');
  
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}`;
    
    // Find the last invoice with this prefix
    const lastInvoice = await Invoice.findOne({
      invoiceNumber: { $regex: `^${prefix}` }
    }).sort({ invoiceNumber: -1 });
    
    let sequence = 1;
    
    if (lastInvoice) {
      // Extract sequence number from last invoice
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length === 3) {
        sequence = parseInt(parts[2]) + 1;
      }
    }
    
    // Generate with padding
    return `${prefix}-${String(sequence).padStart(5, '0')}`;
  } catch (error) {
    //console.error('Error generating invoice number:', error);
    // Fallback to timestamp-based number
    const timestamp = Date.now().toString().slice(-8);
    return `INV-${timestamp}`;
  }
};

/**
 * Generate a random invoice number with timestamp
 * Format: INV-XXXXX-YYYYMMDD
 */
export const generateRandomInvoiceNumber = () => {
  const now = new Date();
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  
  const random = Math.floor(10000 + Math.random() * 90000);
  return `INV-${random}-${date}`;
};

/**
 * Generate invoice number with custom format
 * @param {string} prefix - Custom prefix (default: INV)
 * @param {number} length - Sequence length (default: 5)
 */
export const generateCustomInvoiceNumber = async (prefix = 'INV', length = 5) => {
  const Invoice = mongoose.model('Invoice');
  
  try {
    const lastInvoice = await Invoice.findOne({})
      .sort({ createdAt: -1 })
      .select('invoiceNumber');
    
    let sequence = 1;
    
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length >= 2) {
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) {
          sequence = lastSeq + 1;
        }
      }
    }
    
    const paddedSequence = String(sequence).padStart(length, '0');
    return `${prefix}-${paddedSequence}`;
  } catch (error) {
  // console.error('Error generating invoice number:', error);
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }
};