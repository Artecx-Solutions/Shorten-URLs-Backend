import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { listUsers, getUserById, deleteUserById } from '../controllers/admin.users.controller';

const router = Router();

// All routes below require admin
router.use(auth(true), requireRole('admin'));

/**
 * GET    /api/admin/users            ?page=1&limit=10&q=search&role=user|manager|admin
 * GET    /api/admin/users/:id
 * DELETE /api/admin/users/:id        (?cascade=true to also delete that user's links)
 */
router.get('/', listUsers);
router.get('/:id', getUserById);
router.delete('/:id', deleteUserById);

export default router;
