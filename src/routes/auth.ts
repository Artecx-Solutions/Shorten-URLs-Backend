import express from 'express';
import * as jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth';
import { signup, login, getMe } from '../controllers/authController';

const router = express.Router();

export const JWT_SECRET: jwt.Secret = (process.env.JWT_SECRET || 'dev-secret') as jwt.Secret;
export const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '7d';

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, getMe);

export default router;
