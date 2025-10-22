import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { Link } from '../models/Link';
import type { LinkDoc } from '../models/Link';
import { CreateLinkRequest, CreateLinkResponse, LinkAnalytics } from '../types/link';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

// ---------- helpers ----------
const putIf = <T extends object, K extends keyof T>(obj: T, key: K, val: T[K] | undefined) => {
  if (val !== undefined && val !== null && String(val).trim() !== '') {
    // @ts-expect-error dynamic ok
    obj[key] = typeof val === 'string' ? (val as string).trim() : val;
  }
  return obj;
};

const normalizeUrl = (raw: string) => {
  let u = (raw || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const url = new URL(u);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
};

const randomCode = (len = 6) => Math.random().toString(36).slice(2, 2 + len);
const generateUniqueShortCode = async (len = 6): Promise<string> => {
  let code = randomCode(len);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await Link.exists({ shortCode: code });
    if (!exists) return code;
    code = randomCode(len);
  }
};

const isReserved = (alias: string) => {
  const reserved = new Set(['api', 'r', 'redirect', 'admin', 'login', 'signup', 'health']);
  return reserved.has(alias.toLowerCase());
};

// ---------- zod ----------
const createLinkSchema = z.object({
  originalUrl: z.string().url().or(z.string().min(4)), // we'll normalize if missing protocol
  customAlias: z.string().regex(/^[a-zA-Z0-9-_]{3,30}$/).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional()
});

// ---------- page metadata ----------
interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  siteName?: string;
}
const fetchPageMetadata = async (url: string): Promise<PageMetadata> => {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkShortener/1.0)' }
    });
    const $ = cheerio.load(response.data);
    const title =
      $('title').text() ||
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content');

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content');

    const keywords = $('meta[name="keywords"]').attr('content');

    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content');

    const siteName =
      $('meta[property="og:site_name"]').attr('content') ||
      new URL(url).hostname;

    let meta: PageMetadata = {};
    putIf(meta, 'title', title);
    putIf(meta, 'description', description);
    putIf(meta, 'keywords', keywords);
    putIf(meta, 'image', image);
    putIf(meta, 'siteName', siteName);
    return meta;
  } catch {
    return {};
  }
};

// ---------- controllers ----------

// Per-user quota: max 5 created in the last 60 minutes
async function enforceCreateQuota(userId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await Link.countDocuments({
    createdBy: userId,
    createdAt: { $gt: oneHourAgo }
  });
  if (recentCount >= 5) {
    const retryInMins = 60; // (you can compute exact mins left, but requirement says “wait 1 hour”)
    const error: any = new Error(`Quota exceeded: you can create only 5 links per hour. Try again in ~${retryInMins} minutes.`);
    error.status = 429;
    throw error;
  }
}

// Create short link (AUTH REQUIRED)
export const createShortLink = async (
  req: Request<{}, {}, CreateLinkRequest>,
  res: Response<CreateLinkResponse | { error: string }>,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() as unknown as string });
      return;
    }

    const userId = (req as any).user?.sub as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await enforceCreateQuota(userId);

    const { originalUrl, customAlias, title, description } = parsed.data;
    const normalizedUrl = normalizeUrl(originalUrl);

    if (customAlias) {
      if (isReserved(customAlias)) {
        res.status(400).json({ error: 'Custom alias is reserved' });
        return;
      }
      const existingAlias = await Link.findOne({ shortCode: customAlias });
      if (existingAlias) {
        res.status(400).json({ error: 'Custom alias already exists' });
        return;
      }
    }

    // If user already created a short link for same URL, return it
    const existing = await Link.findOne({
      originalUrl: new RegExp(`^${normalizedUrl}$`, 'i'),
      createdBy: userId
    });
    if (existing) {
      res.status(200).json({
        shortUrl: `${req.protocol}://${req.get('host')}/r/${existing.shortCode}`,
        originalUrl: existing.originalUrl,
        shortCode: existing.shortCode,
        clicks: existing.clicks,
        message: 'Existing short link found for this URL'
      });
      return;
    }

    const shortCode = customAlias ?? (await generateUniqueShortCode());
    const expiresAt = new Date(Date.now() + FIVE_DAYS_MS);

    const link = await Link.create({
      originalUrl: normalizedUrl,
      shortCode,
      customAlias: customAlias || undefined,
      createdBy: userId,
      expiresAt,
      isActive: true,
      title,
      description
    });

    res.status(201).json({
      shortUrl: `${req.protocol}://${req.get('host')}/r/${link.shortCode}`,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks
    });
  } catch (err) {
    next(err);
  }
};

export const redirectToOriginalUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shortCode } = req.params;
    const link = await Link.findOne({ shortCode, isActive: true });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This short URL has expired' });
    }

    link.clicks += 1;
    await link.save();

    res.redirect(link.originalUrl);
  } catch (e) {
    next(e);
  }
};

export const getLinkInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shortCode } = req.params;
    const link = await Link.findOne({ shortCode });
    if (!link) return res.status(404).json({ error: 'Short URL not found' });

    res.json({
      success: true,
      data: {
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        clicks: link.clicks,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        isActive: link.isActive,
        title: link.title,
        description: link.description
      }
    });
  } catch (e) {
    next(e);
  }
};

export const getLinkAnalytics = async (req: Request, res: Response<LinkAnalytics | { error: string }>, next: NextFunction) => {
  try {
    const { shortCode } = req.params;
    const userId = (req as any).user?.sub as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const link = await Link.findOne({ shortCode, createdBy: userId });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    const analytics: LinkAnalytics = {
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      isActive: link.isActive
    };
    res.json(analytics);
  } catch (e) {
    next(e);
  }
};

export const getUserLinks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.sub as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const page = Number.parseInt((req.query.page as string) || '1');
    const limit = Math.min(50, Number.parseInt((req.query.limit as string) || '10'));
    const skip = (page - 1) * limit;

    const [links, total] = await Promise.all([
      Link.find({ createdBy: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Link.countDocuments({ createdBy: userId })
    ]);

    res.json({
      success: true,
      links,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (e) {
    next(e);
  }
};

export const deleteLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.sub as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { shortCode } = req.params;
    const link = await Link.findOneAndDelete({ shortCode, createdBy: userId });
    if (!link) return res.status(404).json({ success: false, message: 'Link not found' });

    res.json({ success: true, message: 'Link deleted successfully' });
  } catch (e) {
    next(e);
  }
};

// Extra: Details plus metadata (delayed page)
export const getLinkForDelay = async (
  req: Request,
  res: Response<LinkAnalytics & { metadata?: PageMetadata } | { error: string }>,
  next: NextFunction
) => {
  try {
    const { shortCode } = req.params;
    const link = await Link.findOne({ shortCode, isActive: true });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    const metadata = await fetchPageMetadata(link.originalUrl);
    const result: LinkAnalytics & { metadata?: PageMetadata } = {
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      isActive: link.isActive
    };
    if (Object.keys(metadata).length > 0) result.metadata = metadata;

    res.json(result);
  } catch (e) {
    next(e);
  }
};