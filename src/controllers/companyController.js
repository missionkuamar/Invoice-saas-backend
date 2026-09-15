import Company from '../models/Company.js';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

// @desc    Get or create company profile
// @route   GET /api/company
export const getCompanyProfile = async (req, res) => {
  try {
    let company = await Company.findOne({ user: req.user?._id || req.user?.id });
    
    if (!company) {
      // Create default company profile with minimal data
      const defaultTaxTypes = [
        { name: 'GST', rate: 18, description: 'Goods and Services Tax', isDefault: true },
        { name: 'VAT', rate: 5, description: 'Value Added Tax', isDefault: false },
        { name: 'Service Tax', rate: 14, description: 'Service Tax', isDefault: false },
        { name: 'CST', rate: 2, description: 'Central Sales Tax', isDefault: false },
      ];

      company = await Company.create({
        user: req.user?._id || req.user?.id,
        companyName: req.user?.name || 'My Company',
        companyEmail: req.user?.email || '',
        companyPhone: '',
        taxSettings: {
          defaultTaxRate: 18,
          taxTypes: defaultTaxTypes,
          calculateTaxOn: 'subtotal',
          roundTax: true,
        },
        currency: 'INR',
        invoiceSettings: {
          prefix: 'INV',
          numberFormat: 'YYYYMM-XXXXX',
          showLogo: true,
          showGST: true,
          showBankDetails: false,
          footerText: 'Thank you for your business!',
          termsText: 'Payment due within 30 days.',
        },
      });
    }
    
    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
  //  console.error('Get company profile error:', error);
    // Return a default company object even if error
    res.status(200).json({
      success: true,
      data: {
        companyName: req.user?.name || 'My Company',
        companyEmail: req.user?.email || '',
        currency: 'INR',
        taxSettings: {
          defaultTaxRate: 18,
          taxTypes: [
            { name: 'GST', rate: 18, isDefault: true },
            { name: 'VAT', rate: 5, isDefault: false },
          ],
        },
      },
    });
  }
};

// @desc    Update company profile
// @route   PUT /api/company
export const updateCompanyProfile = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user?._id || req.user?.id;
    
    let company = await Company.findOne({ user: userId });
    
    if (!company) {
      // Create new company with defaults
      company = new Company({
        user: userId,
        companyName: updates.companyName || req.user?.name || 'My Company',
        companyEmail: updates.companyEmail || req.user?.email || '',
        companyPhone: updates.companyPhone || '',
      });
    }
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key === 'companyAddress' || key === 'taxSettings' || key === 'invoiceSettings' || key === 'bankDetails') {
        if (company[key]) {
          company[key] = { ...company[key], ...updates[key] };
        } else {
          company[key] = updates[key];
        }
      } else if (key !== 'user' && key !== '_id' && key !== 'createdAt') {
        company[key] = updates[key];
      }
    });
    
    company.updatedAt = Date.now();
    await company.save();
    
    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    //console.error('Update company error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Upload company logo
// @route   POST /api/company/logo
export const uploadLogo = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    let company = await Company.findOne({ user: userId });
    
    if (!company) {
      company = new Company({ 
        user: userId,
        companyName: req.user?.name || 'My Company',
        companyEmail: req.user?.email || '',
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }
    
    // Upload to cloudinary if configured, otherwise save locally
    let logoUrl = '';
    let publicId = '';
    
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'invoice-saas/logos',
          width: 200,
          height: 200,
          crop: 'fill',
        });
        logoUrl = result.secure_url;
        publicId = result.public_id;
      } catch (cloudinaryError) {
       // console.error('Cloudinary upload error:', cloudinaryError);
        // Fallback to local
        logoUrl = `/uploads/${req.file.filename}`;
      }
    } else {
      // Local storage fallback
      logoUrl = `/uploads/${req.file.filename}`;
    }
    
    // Remove local file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
     // console.error('Error deleting temp file:', err);
      res.status(500).json({
      success: false,
      message: error.message,
    });
    }
    
    company.logo = {
      url: logoUrl,
      publicId: publicId || '',
    };
    await company.save();
    
    res.status(200).json({
      success: true,
      data: company.logo,
    });
  } catch (error) {
    //console.error('Upload logo error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete company logo
// @route   DELETE /api/company/logo
export const deleteLogo = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const company = await Company.findOne({ user: userId });
    
    if (!company || !company.logo?.publicId) {
      return res.status(404).json({
        success: false,
        message: 'Logo not found',
      });
    }
    
    // Delete from cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && company.logo.publicId) {
      try {
        await cloudinary.uploader.destroy(company.logo.publicId);
      } catch (err) {
       // console.error('Cloudinary delete error:', err);
        res.status(500).json({
      success: false,
      message: error.message,
    });
      }
    }
    
    company.logo = {};
    await company.save();
    
    res.status(200).json({
      success: true,
      message: 'Logo deleted successfully',
    });
  } catch (error) {
    //console.error('Delete logo error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add tax type
// @route   POST /api/company/tax
export const addTaxType = async (req, res) => {
  try {
    const { name, rate, description, isDefault } = req.body;
    const userId = req.user?._id || req.user?.id;
    
    if (!name || rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and rate are required',
      });
    }
    
    let company = await Company.findOne({ user: userId });
    
    if (!company) {
      company = new Company({ 
        user: userId,
        companyName: req.user?.name || 'My Company',
        companyEmail: req.user?.email || '',
      });
    }
    
    // Check if tax already exists
    const existingTax = company.taxSettings.taxTypes.find(
      t => t.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingTax) {
      return res.status(400).json({
        success: false,
        message: 'Tax type already exists',
      });
    }
    
    // If this is default, remove default from others
    if (isDefault) {
      company.taxSettings.taxTypes.forEach(t => t.isDefault = false);
    }
    
    company.taxSettings.taxTypes.push({
      name,
      rate: Number(rate),
      description: description || '',
      isDefault: isDefault || false,
    });
    
    await company.save();
    
    res.status(200).json({
      success: true,
      data: company.taxSettings.taxTypes,
    });
  } catch (error) {
   // console.error('Add tax error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update tax type
// @route   PUT /api/company/tax/:taxId
export const updateTaxType = async (req, res) => {
  try {
    const { taxId } = req.params;
    const { name, rate, description, isDefault } = req.body;
    const userId = req.user?._id || req.user?.id;
    
    const company = await Company.findOne({ user: userId });
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }
    
    const taxIndex = company.taxSettings.taxTypes.findIndex(
      t => t._id.toString() === taxId
    );
    
    if (taxIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Tax type not found',
      });
    }
    
    // If this is default, remove default from others
    if (isDefault) {
      company.taxSettings.taxTypes.forEach(t => t.isDefault = false);
    }
    
    const tax = company.taxSettings.taxTypes[taxIndex];
    if (name) tax.name = name;
    if (rate !== undefined) tax.rate = Number(rate);
    if (description !== undefined) tax.description = description;
    tax.isDefault = isDefault || false;
    
    await company.save();
    
    res.status(200).json({
      success: true,
      data: company.taxSettings.taxTypes,
    });
  } catch (error) {
 //   console.error('Update tax error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete tax type
// @route   DELETE /api/company/tax/:taxId
export const deleteTaxType = async (req, res) => {
  try {
    const { taxId } = req.params;
    const userId = req.user?._id || req.user?.id;
    const company = await Company.findOne({ user: userId });
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }
    
    const taxIndex = company.taxSettings.taxTypes.findIndex(
      t => t._id.toString() === taxId
    );
    
    if (taxIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Tax type not found',
      });
    }
    
    // Don't allow deleting if it's the only tax type
    if (company.taxSettings.taxTypes.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last tax type',
      });
    }
    
    // If deleting default, set another as default
    const isDeletingDefault = company.taxSettings.taxTypes[taxIndex].isDefault;
    company.taxSettings.taxTypes.splice(taxIndex, 1);
    
    if (isDeletingDefault && company.taxSettings.taxTypes.length > 0) {
      company.taxSettings.taxTypes[0].isDefault = true;
    }
    
    await company.save();
    
    res.status(200).json({
      success: true,
      data: company.taxSettings.taxTypes,
    });
  } catch (error) {
   // console.error('Delete tax error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};