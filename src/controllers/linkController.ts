import { Request, Response, NextFunction } from 'express';
import { Link } from '../models/Link';
import { CreateLinkRequest, CreateLinkResponse, LinkAnalytics } from '../types/link';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Add this interface for metadata
interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
}

// Helper function to fetch page metadata
const fetchPageMetadata = async (url: string): Promise<PageMetadata> => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkShortener/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const metadata: PageMetadata = {
      title: $('title').text() || $('meta[property="og:title"]').attr('content'),
      description: $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content'),
      image: $('meta[property="og:image"]').attr('content')
    };

    // Clean up the data
    Object.keys(metadata).forEach(key => {
      if (metadata[key as keyof PageMetadata]) {
        metadata[key as keyof PageMetadata] = metadata[key as keyof PageMetadata]?.trim();
      }
    });

    return metadata;
  } catch (error) {
    console.error('Error fetching page metadata:', error);
    return {};
  }
};

// Update the createShortLink function to include user
export const createShortLink = async (
  req: Request<{}, {}, CreateLinkRequest>,
  res: Response<CreateLinkResponse | { error: string }>,
  next: NextFunction
): Promise<void> => {
  try {
    const { originalUrl, customAlias } = req.body;

    // Normalize URL for better duplicate detection
    const normalizedUrl = originalUrl.trim().toLowerCase();

    // Check if custom alias exists (regardless of URL)
    if (customAlias) {
      const existingAlias = await Link.findOne({ shortCode: customAlias });
      if (existingAlias) {
        res.status(400).json({ error: 'Custom alias already exists' });
        return;
      }
    }

    // Check for existing links with the same URL for this user
    const existingLinksQuery: any = { 
      originalUrl: { $regex: new RegExp(`^${normalizedUrl}$`, 'i') }
    };

    // If user is logged in, only check their links
    if (req.user) {
      existingLinksQuery.createdBy = req.user.userId;
    } else {
      // For anonymous users, only check links without user
      existingLinksQuery.createdBy = null;
    }

    const existingLinks = await Link.find(existingLinksQuery);

    if (existingLinks.length > 0) {
      // Return existing link
      const existingLink = existingLinks[0];
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

    // Create new link
    const link = new Link({
      originalUrl: normalizedUrl,
      customAlias: customAlias || undefined,
      createdBy: req.user?.userId || null
    });

    await link.save();

    const response: CreateLinkResponse = {
      shortUrl: `${req.protocol}://${req.get('host')}/${link.shortCode}`,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks
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

    const link = await Link.findOne({ 
      shortCode,
      isActive: true 
    });

    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    // Update click count
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
      isActive: link.isActive
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

    const link = await Link.findOne({ 
      shortCode,
      isActive: true 
    });

    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    // Fetch metadata from the original URL
    const metadata = await fetchPageMetadata(link.originalUrl);

    const analytics: LinkAnalytics & { metadata?: PageMetadata } = {
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      clicks: link.clicks,
      createdAt: link.createdAt,
      isActive: link.isActive,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    };

    res.json(analytics);
  } catch (error) {
    next(error);
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

    const links = await Link.find({ createdBy: req.user?.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Link.countDocuments({ createdBy: req.user?.userId });

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
  } catch (error) {
    next(error);
  }
};