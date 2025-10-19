import express from 'express';
import { auth } from '../middleware/auth';
import {
  createShortLink,
  getLinkAnalytics,
  getLinkForDelay,
  getUserLinks,
  getLinkInfo,
  deleteLink
} from '../controllers/linkController';

const router = express.Router();

router.post('/shorten', createShortLink);
router.get('/delay/:shortCode', getLinkForDelay);
router.get('/:shortCode', getLinkInfo);
router.get('/analytics/:shortCode', auth, getLinkAnalytics);
router.get('/my-links', auth, getUserLinks);
router.delete('/:shortCode', auth, deleteLink);

export default router;
