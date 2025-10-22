import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  createShortLink,
  redirectToOriginalUrl,
  getLinkAnalytics,
  getUserLinks,
  getLinkInfo,
  deleteLink,
  getLinkForDelay
} from '../controllers/link.controller';

const router = Router();

// create
router.post('/', auth(true), createShortLink);

router.get('/my', auth(true), getUserLinks);

router.get('/:shortCode/info', getLinkInfo);
router.get('/:shortCode/analytics', auth(true), getLinkAnalytics);
router.delete('/:shortCode', auth(true), deleteLink);

router.get('/delay/:shortCode', getLinkForDelay);

router.get('/r/:shortCode', redirectToOriginalUrl);

export default router;