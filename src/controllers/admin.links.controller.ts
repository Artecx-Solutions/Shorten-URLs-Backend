import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Link } from '../models/Link';

// small helpers
const toInt = (v: string | undefined, def: number, max?: number) => {
  const n = Number.parseInt(String(v ?? ''));
  if (Number.isNaN(n) || n <= 0) return def;
  return max ? Math.min(n, max) : n;
};

const isObjectId = (s: string) => mongoose.isValidObjectId(s);

// GET /api/admin/links
// ?page=1&limit=10&q=example&createdBy=<userId>&active=true|false&expired=true|false&from=2025-10-01&to=2025-10-25&sort=createdAt|-createdAt
export async function listAllLinks(req: Request, res: Response, next: NextFunction) {
  try {
    const page = toInt(req.query.page as string, 1);
    const limit = toInt(req.query.limit as string, 10, 100);
    const skip = (page - 1) * limit;

    const q = (req.query.q as string | undefined)?.trim();
    const createdBy = (req.query.createdBy as string | undefined)?.trim();
    const active = (req.query.active as string | undefined)?.trim();
    const expired = (req.query.expired as string | undefined)?.trim();
    const from = (req.query.from as string | undefined)?.trim();
    const to = (req.query.to as string | undefined)?.trim();
    const sortParam = (req.query.sort as string | undefined)?.trim() || '-createdAt';

    const filter: any = {};

    if (q && q.length > 0) {
      // search in originalUrl, shortCode, title, description
      filter.$or = [
        { originalUrl: { $regex: q, $options: 'i' } },
        { shortCode: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    if (createdBy && isObjectId(createdBy)) {
      filter.createdBy = new mongoose.Types.ObjectId(createdBy);
    }

    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;

    if (expired === 'true') {
      filter.expiresAt = { $lt: new Date() };
    } else if (expired === 'false') {
      filter.expiresAt = { $gte: new Date() };
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    // build sort: e.g. "-createdAt" or "clicks"
    const sort: Record<string, 1 | -1> = {};
    const fields = (sortParam || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const f of fields) {
      if (f.startsWith('-')) sort[f.slice(1)] = -1;
      else sort[f] = 1;
    }

    const [links, total] = await Promise.all([
      Link.find(filter)
        .select('-passwordHash') // don’t expose hashes even to admin responses
        .populate('createdBy', 'fullName email role')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Link.countDocuments(filter)
    ]);

    res.json({
      success: true,
      links,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/links/:idOrCode  (by _id or by shortCode)
export async function getLinkAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idOrCode } = req.params;
    const byId = isObjectId(idOrCode);

    const link = await Link.findOne(
      byId ? { _id: idOrCode } : { shortCode: idOrCode }
    )
      .select('-passwordHash')
      .populate('createdBy', 'fullName email role')
      .lean();

    if (!link) return res.status(404).json({ error: 'Link not found' });

    res.json({ success: true, link });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/links/:idOrCode
export async function deleteLinkAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idOrCode } = req.params;
    const byId = isObjectId(idOrCode);

    const link = await Link.findOneAndDelete(byId ? { _id: idOrCode } : { shortCode: idOrCode })
      .select('-passwordHash')
      .lean();

    if (!link) return res.status(404).json({ error: 'Link not found' });

    res.json({ success: true, message: 'Link deleted', shortCode: link.shortCode, id: String(link._id) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/links/:idOrCode/status   { isActive: boolean }
export async function setLinkActiveAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idOrCode } = req.params;
    const { isActive } = (req.body ?? {}) as { isActive?: boolean };
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive boolean is required in body' });
    }

    const byId = isObjectId(idOrCode);
    const link = await Link.findOneAndUpdate(
      byId ? { _id: idOrCode } : { shortCode: idOrCode },
      { $set: { isActive } },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!link) return res.status(404).json({ error: 'Link not found' });

    res.json({ success: true, link });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/links/stats (quick aggregates)
export async function getLinksStatsAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const stats = await Link.aggregate([
      {
        $facet: {
          totals: [
            { $group: { _id: null, totalLinks: { $sum: 1 }, totalClicks: { $sum: '$clicks' } } }
          ],
          active: [
            { $match: { isActive: true } },
            { $count: 'count' }
          ],
          expired: [
            { $match: { expiresAt: { $lt: now } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const totals = stats[0]?.totals?.[0] ?? { totalLinks: 0, totalClicks: 0 };
    const active = stats[0]?.active?.[0]?.count ?? 0;
    const expired = stats[0]?.expired?.[0]?.count ?? 0;

    res.json({
      success: true,
      stats: {
        totalLinks: totals.totalLinks,
        totalClicks: totals.totalClicks,
        activeLinks: active,
        expiredLinks: expired
      }
    });
  } catch (err) {
    next(err);
  }
}
