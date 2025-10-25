import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import {
  listAllLinks,
  getLinkAdmin,
  deleteLinkAdmin,
  setLinkActiveAdmin,
  getLinksStatsAdmin
} from '../controllers/admin.links.controller';

const router = Router();

// All endpoints here are admin-only
router.use(auth(true), requireRole('admin'));

/**
 * GET    /api/admin/links              list with filters (any user's links)
 * GET    /api/admin/links/stats        totals/active/expired/clicks
 * GET    /api/admin/links/:idOrCode    view by ObjectId or shortCode
 * DELETE /api/admin/links/:idOrCode    delete any link
 * PATCH  /api/admin/links/:idOrCode/status  { isActive: boolean } activate/deactivate
 */
router.get('/', listAllLinks);
router.get('/stats', getLinksStatsAdmin);
router.get('/:idOrCode', getLinkAdmin);
router.delete('/:idOrCode', deleteLinkAdmin);
router.patch('/:idOrCode/status', setLinkActiveAdmin);

export default router;
