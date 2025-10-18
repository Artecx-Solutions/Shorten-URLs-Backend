import { Router } from 'express';
import {
  createShortLink,
  redirectToOriginalUrl,
  getLinkAnalytics,
  getLinkForDelay,
  getUserLinks
} from '../controllers/linkController';
import { validateCreateLink } from '../middleware/validation';
import { auth, optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/shorten', optionalAuth, validateCreateLink, createShortLink);
router.get('/user/links', auth, getUserLinks); // Add user links route
router.get('/:shortCode', redirectToOriginalUrl);
router.get('/analytics/:shortCode', getLinkAnalytics);
router.get('/delay/:shortCode', getLinkForDelay);

export default router;