import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Link } from '../models/Link';

// Utility: parse pagination safely
const toInt = (v: string | undefined, def: number, max?: number) => {
  const n = Number.parseInt(String(v ?? ''));
  if (Number.isNaN(n) || n <= 0) return def;
  return max ? Math.min(n, max) : n;
};

// GET /api/admin/users
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = toInt(req.query.page as string, 1);
    const limit = toInt(req.query.limit as string, 10, 100);
    const skip = (page - 1) * limit;

    const q = (req.query.q as string | undefined)?.trim();
    const role = (req.query.role as 'admin' | 'manager' | 'user' | undefined)?.trim();

    const filter: any = {};
    if (q && q.length > 0) {
      filter.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    if (role) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')   // never return passwordHash
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/users/:id
export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findById(id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/users/:id  (optional cascade delete of links)
export async function deleteUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findByIdAndDelete(id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // OPTIONAL: clean up the user's short links
    const { cascade } = req.query; // pass ?cascade=true to also delete links
    if (String(cascade).toLowerCase() === 'true') {
      await Link.deleteMany({ createdBy: user._id });
    }

    res.json({ success: true, message: 'User deleted', userId: String(user._id) });
  } catch (err) {
    next(err);
  }
}
