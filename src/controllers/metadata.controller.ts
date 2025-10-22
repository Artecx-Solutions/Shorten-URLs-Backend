import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PageMeta } from '../models/PageMeta';

const getMeta = ($: cheerio.CheerioAPI, name: string) =>
  $(`meta[name="${name}"]`).attr('content') ||
  $(`meta[property="og:${name}"]`).attr('content') ||
  $(`meta[property="twitter:${name}"]`).attr('content') ||
  '';

export const fetchMetadata = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    // try cache first
    const cached = await PageMeta.findOne({ url });
    if (cached) {
      return res.json({ success: true, cached: true, metadata: cached });
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const $ = cheerio.load(response.data);
    const metadata = {
      title: $('title').text() || getMeta($, 'title') || 'No title available',
      description: getMeta($, 'description') || $('meta[name="description"]').attr('content') || 'No description available',
      image: getMeta($, 'image') || $('meta[property="og:image"]').attr('content') || $('meta[property="twitter:image"]').attr('content') || '',
      keywords: getMeta($, 'keywords') || '',
      siteName: getMeta($, 'site_name') || new URL(url).hostname,
      url
    };

    // save cache
    await PageMeta.findOneAndUpdate({ url }, { ...metadata, fetchedAt: new Date() }, { upsert: true });

    res.json({ success: true, metadata });
  } catch (error) {
    console.error('❌ Metadata fetch error:', (error as any)?.message);
    const fallback = {
      title: 'No title available',
      description: 'No description available',
      image: '',
      keywords: '',
      siteName: (() => {
        try { return new URL((req.body as any)?.url).hostname; } catch { return ''; }
      })(),
      url: (req.body as any)?.url ?? ''
    };
    res.json({ success: false, metadata: fallback, message: 'Using fallback metadata' });
  }
};
