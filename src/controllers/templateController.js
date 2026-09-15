import InvoiceTemplate from '../models/InvoiceTemplate.js';

// Predefined templates data
const defaultTemplates = [
  {
    name: 'Simple Business',
    type: 'simple',
    description: 'Clean and straightforward for small businesses',
    style: {
      primaryColor: '#0ea5e9',
      secondaryColor: '#1e293b',
      fontFamily: 'Inter, sans-serif',
      headerStyle: 'left',
      showLogo: true,
      showFooter: true,
      showTerms: true,
    },
    layout: 'standard',
  },
  {
    name: 'Modern Professional',
    type: 'modern',
    description: 'Contemporary design with bold accents',
    style: {
      primaryColor: '#8b5cf6',
      secondaryColor: '#1e1b4b',
      fontFamily: 'Poppins, sans-serif',
      headerStyle: 'centered',
      showLogo: true,
      showFooter: true,
      showTerms: true,
    },
    layout: 'standard',
  },
  {
    name: 'Corporate Elegant',
    type: 'corporate',
    description: 'Formal and sophisticated for corporate use',
    style: {
      primaryColor: '#0f172a',
      secondaryColor: '#334155',
      fontFamily: 'Georgia, serif',
      headerStyle: 'right',
      showLogo: true,
      showFooter: true,
      showTerms: true,
    },
    layout: 'detailed',
  },
  {
    name: 'Creative Studio',
    type: 'creative',
    description: 'Vibrant and artistic for creative agencies',
    style: {
      primaryColor: '#ec4899',
      secondaryColor: '#831843',
      fontFamily: 'Playfair Display, serif',
      headerStyle: 'centered',
      showLogo: true,
      showFooter: true,
      showTerms: true,
    },
    layout: 'compact',
  },
  {
    name: 'Minimal Clean',
    type: 'minimal',
    description: 'Minimalist design focusing on content',
    style: {
      primaryColor: '#64748b',
      secondaryColor: '#0f172a',
      fontFamily: 'Inter, sans-serif',
      headerStyle: 'left',
      showLogo: false,
      showFooter: false,
      showTerms: false,
    },
    layout: 'minimal',
  },
  {
    name: 'Elegant Classic',
    type: 'elegant',
    description: 'Timeless design with classic typography',
    style: {
      primaryColor: '#854d0e',
      secondaryColor: '#451a03',
      fontFamily: 'Merriweather, serif',
      headerStyle: 'centered',
      showLogo: true,
      showFooter: true,
      showTerms: true,
    },
    layout: 'detailed',
  },
];

// @desc    Get all templates
// @route   GET /api/templates
export const getTemplates = async (req, res) => {
  try {
    let templates = await InvoiceTemplate.find({ isActive: true });
    
    // If no templates in DB, create default ones
    if (templates.length === 0) {
      templates = await InvoiceTemplate.create(defaultTemplates);
    }
    
    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single template
// @route   GET /api/templates/:id
export const getTemplate = async (req, res) => {
  try {
    const template = await InvoiceTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }
    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create custom template
// @route   POST /api/templates
export const createTemplate = async (req, res) => {
  try {
    const template = await InvoiceTemplate.create(req.body);
    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};