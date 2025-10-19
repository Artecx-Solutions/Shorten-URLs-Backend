import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Link } from '../models/Link';
import { CreateLinkRequest, CreateLinkResponse, LinkAnalytics } from '../types/link';

// With exactOptionalPropertyTypes, keep these truly optional
interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
}

const trim = (v?: string) => (typeof v === 'string' ? v.trim() : undefined);

// Helper to fetch Open Graph / meta tags
const fetchPageMetadata = async (url: string): Promise<PageMetadata> => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkShortener/1.0)' },
    });

    const $ = cheerio.load(response.data);

    const rawTitle =
      $('title').text() || $('meta[property="og:title"]').attr('content');
    const rawDescription =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content');
    const rawKeywords = $('meta[name="keywords"]').attr('content');
    const rawImage = $('meta[property="og:image"]').attr('content');

    const title = trim(rawTitle);
    const description = trim(rawDescription);
    const keywords = trim(rawKeywords);
    const image = trim(rawImage);

    // Only include keys that are defined (no `undefined` assigned to present keys)
    const metadata: PageMetadata = {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(keywords ? { keywords } : {}),
      ...(image ? { image } : {}),
    };

    return metadata;
  } catch {
    return {};
  }
};

// Create short link (optionally scoped to a user)
export const createShortLink = async (
  req: Request<{}, {}, CreateLinkRequest>,
  res: Response<CreateLinkResponse | { error: string }>,
  next: NextFunction
): Promise<void> => {
  try {
    const { originalUrl, customAlias } = req.body;

    const normalizedUrl = originalUrl.trim();

    if (customAlias) {
      const existingAlias = await Link.findOne({ shortCode: customAlias });
      if (existingAlias) {
        res.status(400).json({ error: 'Custom alias already exists' });
        return;
      }
    }

    const existingLinksQuery: Record<string, any> = {
      // exact match, case-insensitive; escape regex specials
      originalUrl: new RegExp(
        `^${normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      ),
    };

    if (req.user?.userId) {
      existingLinksQuery.createdBy = req.user.userId;
    } else {
      // treat anonymous matches
      existingLinksQuery.createdBy = { $in: [null, 'anonymous'] };
    }

    const existingLink = await Link.findOne(existingLinksQuery);
    if (existingLink) {
      const response: CreateLinkResponse = {
        shortUrl: `${req.protocol}://${req.get('host')}/${existingLink.shortCode}`,
        originalUrl: existingLink.originalUrl,
        shortCode: existingLink.shortCode,
        clicks: existingLink.clicks,
        message: 'Existing short link found for this URL',
      };
      res.status(200).json(response);
      return;
    }

    const link = new Link({
      originalUrl: normalizedUrl,
      shortCode: customAlias || undefined,
      createdBy: req.user?.userId ?? undefined, // omit for anonymous if your schema defaults it
    });

    await link.save();

    const response: CreateLinkResponse = {
      shortUrl: `${req.protocol}://${req.get('host')}/${link.shortCode}`,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
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

    link.clicks += 1;
    await link.save();

    res.redirect(link.originalUrl);
  } catch (error) {
    next(error);
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
      isActive: link.isActive,
    };

    res.json(analytics);
  } catch (error) {
    next(error);
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

    const md = await fetchPageMetadata(link.originalUrl);

    const analytics: LinkAnalytics & { metadata?: PageMetadata } = {
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      isActive: link.isActive,
    };

    if (Object.keys(md).length > 0) {
      analytics.metadata = md;
    }

    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

// Paginated list of a user's links
export const getUserLinks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const [links, total] = await Promise.all([
      Link.find({ createdBy: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Link.countDocuments({ createdBy: userId }),
    ]);

    res.json({
      success: true,
      links,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
