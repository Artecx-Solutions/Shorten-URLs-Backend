import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.post('/signup', signup);
router.post('/login',  login);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', auth(true), (req, res) => res.json({ user: (req as any).user }));
router.get('/admin', auth(true), requireRole('admin'), (_req, res) => res.json({ ok: true, area: 'admin' }));
router.get('/manager', auth(true), requireRole('manager','admin'), (_req, res) => res.json({ ok: true, area: 'manager' }));

export default router;
