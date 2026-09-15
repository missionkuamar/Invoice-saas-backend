import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getCompanyProfile,
  updateCompanyProfile,
  uploadLogo,
  deleteLogo,
  addTaxType,
  updateTaxType,
  deleteTaxType,
} from '../controllers/companyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: fileFilter,
});

// All routes require authentication
router.use(protect);

// Company profile routes
router.route('/')
  .get(getCompanyProfile)
  .put(updateCompanyProfile);

// Logo routes
router.post('/logo', upload.single('logo'), uploadLogo);
router.delete('/logo', deleteLogo);

// Tax routes
router.post('/tax', addTaxType);
router.put('/tax/:taxId', updateTaxType);
router.delete('/tax/:taxId', deleteTaxType);

export default router;