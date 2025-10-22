import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { env } from '../config/env';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh'
  };
}

export async function signup(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, password } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'user'
  });

  const payload = { sub: String(user._id), role: user.role, tv: user.tokenVersion };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res
    .cookie('refreshToken', refreshToken, refreshCookieOptions())
    .status(201)
    .json({ accessToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = { sub: String(user._id), role: user.role, tv: user.tokenVersion };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  res
    .cookie('refreshToken', refreshToken, refreshCookieOptions())
    .json({ accessToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Missing refresh token' });
  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const nextPayload = { sub: String(user._id), role: user.role, tv: user.tokenVersion };
    const accessToken = signAccessToken(nextPayload);
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(_req: Request, res: Response) {
  // If you want to invalidate all refresh tokens for user, bump tokenVersion in a protected endpoint.
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ message: 'Logged out' });
}
