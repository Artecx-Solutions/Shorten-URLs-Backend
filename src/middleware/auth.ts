import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret') as jwt.Secret;

type TokenPayload = jwt.JwtPayload & { userId?: string; email?: string };

export const auth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    if (!decoded || !decoded.email) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const authUser: { _id: string; email: string; userId?: string } = {
      _id: decoded.userId ?? '',
      email: decoded.email,
    };
    if (decoded.userId) authUser.userId = decoded.userId; 

    req.user = authUser;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
