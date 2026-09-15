import express from 'express';
import {
  getTemplates,
  getTemplate,
  createTemplate,
} from '../controllers/templateController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.get('/', getTemplates);
router.get('/:id', getTemplate);
router.post('/', createTemplate);

export default router;