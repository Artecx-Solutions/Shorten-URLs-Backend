import * as jwt from 'jsonwebtoken'; // fix for no default export
import { env } from '../config/env';

export type JWTPayload = { sub: string; role: 'admin' | 'manager' | 'user'; tv: number };

export function signAccessToken(payload: JWTPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m` });
}

export function signRefreshToken(payload: JWTPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JWTPayload;
}
