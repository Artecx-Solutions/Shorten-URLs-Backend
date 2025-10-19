import { Request, Response, NextFunction } from 'express';
import { Link } from '../models/Link';
import { CreateLinkRequest, CreateLinkResponse, LinkAnalytics } from '../types/link';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Avoid undefined assignment with exactOptionalPropertyTypes
interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
}

// Helper: build metadata only with defined values
const putIf = <T extends object, K extends keyof T>(obj: T, key: K, val: T[K] | undefined) => {
  if (val !== undefined && val !== null && String(val).trim() !== '') {
    // @ts-expect-error safe dynamic assign
    obj[key] = typeof val === 'string' ? (val as string).trim() : val;
  }
  return obj;
};

// Helper function to fetch page metadata
const fetchPageMetadata = async (url: string): Promise<PageMetadata> => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
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

    // Build object conditionally (prevents assigning undefined)
    let meta: PageMetadata = {};
    putIf(meta, 'title', title);
    putIf(meta, 'description', description);
    putIf(meta, 'keywords', keywords);
    putIf(meta, 'image', image);

    return meta;
  } catch (error) {
    console.error('Error fetching page metadata:', error);
    return {};
  }
};

// Create short link
export const createShortLink = async (
  req: Request<{}, {}, CreateLinkRequest>,
  res: Response<CreateLinkResponse | { error: string }>,
  next: NextFunction
): Promise<void> => {
  try {
    const { originalUrl, customAlias } = req.body;
    const normalizedUrl = originalUrl.trim().toLowerCase();

    if (customAlias) {
      const existingAlias = await Link.findOne({ shortCode: customAlias });
      if (existingAlias) {
        res.status(400).json({ error: 'Custom alias already exists' });
        return;
      }
    }

    const existingLinksQuery: any = {
      originalUrl: { $regex: new RegExp(`^${normalizedUrl}$`, 'i') }
    };

    if (req.user?.userId || req.user?._id) {
      existingLinksQuery.createdBy = (req.user.userId ?? req.user._id);
    } else {
      existingLinksQuery.createdBy = null;
    }

    const existingLinks = await Link.find(existingLinksQuery);

    if (existingLinks.length > 0) {
      const existingLink = existingLinks[0]!;
      const response: CreateLinkResponse = {
        shortUrl: `${req.protocol}://${req.get('host')}/${existingLink.shortCode}`,
        originalUrl: existingLink.originalUrl,
        shortCode: existingLink.shortCode,
        clicks: existingLink.clicks,
        message: 'Existing short link found for this URL'
      };
      res.status(200).json(response);
      return;
    }

    const link = new Link({
      originalUrl: normalizedUrl,
      customAlias: customAlias || undefined,
      createdBy: (req.user?.userId ?? req.user?._id) || null
    });

    await link.save();

    const response: CreateLinkResponse = {
      shortUrl: `${req.protocol}://${req.get('host')}/${link.shortCode}`,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks
    };

    res.status(201).json(response);
    return;
  } catch (error) {
    next(error);
    return;
  }
};

export const redirectToOriginalUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({ shortCode, isActive: true });
    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ error: 'This short URL has expired' });
      return;
    }

    link.clicks += 1;
    await link.save();

    res.redirect(link.originalUrl);
    return;
  } catch (error) {
    next(error);
    return;
  }
};

export const getLinkAnalytics = async (
  req: Request,
  res: Response<LinkAnalytics | { error: string }>,
  next: NextFunction
): Promise<void> => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({ shortCode });
    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    const analytics: LinkAnalytics = {
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      isActive: link.isActive
    };

    res.json(analytics);
    return;
  } catch (error) {
    next(error);
    return;
  }
};

export const getLinkForDelay = async (
  req: Request,
  res: Response<LinkAnalytics & { metadata?: PageMetadata } | { error: string }>,
  next: NextFunction
): Promise<void> => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({ shortCode, isActive: true });
    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    const metadata = await fetchPageMetadata(link.originalUrl);

    // Build result without assigning undefined directly
    const analytics: LinkAnalytics & { metadata?: PageMetadata } = {
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      isActive: link.isActive
    };
    if (Object.keys(metadata).length > 0) analytics.metadata = metadata;

    res.json(analytics);
    return;
  } catch (error) {
    next(error);
    return;
  }
};

// NEW: plain info (no redirect) for a shortCode
export const getLinkInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shortCode } = req.params;
    const link = await Link.findOne({ shortCode, isActive: true });

    if (!link) {
      res.status(404).json({ success: false, message: 'Short URL not found' });
      return;
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ success: false, message: 'This short URL has expired' });
      return;
    }

    res.json({
      success: true,
      data: {
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        clicks: link.clicks,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        isActive: link.isActive
      }
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
};

// Add function to get user's links
export const getUserLinks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const createdBy = (req.user?.userId ?? req.user?._id) || null;

    const [links, total] = await Promise.all([
      Link.find({ createdBy }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Link.countDocuments({ createdBy })
    ]);

    res.json({
      success: true,
      links,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
};

// NEW: delete link owned by current user
export const deleteLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shortCode } = req.params;
    const createdBy = (req.user?.userId ?? req.user?._id) || null;

    const link = await Link.findOneAndDelete({ shortCode, createdBy });
    if (!link) {
      res.status(404).json({ success: false, message: 'Link not found' });
      return;
    }

    res.json({ success: true, message: 'Link deleted successfully' });
    return;
  } catch (error) {
    next(error);
    return;
  }
};
