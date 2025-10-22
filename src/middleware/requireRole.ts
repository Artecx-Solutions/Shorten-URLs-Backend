import { Request, Response, NextFunction } from 'express';

export function requireRole(...roles: Array<'admin'|'manager'|'user'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: string } | undefined;
    if (!user?.role || !roles.includes(user.role as any)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
