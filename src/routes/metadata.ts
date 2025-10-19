import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = express.Router();

router.post('/', async (req, res): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const $ = cheerio.load(response.data);
    const getMeta = (name: string) =>
      $(`meta[name="${name}"]`).attr('content') ||
      $(`meta[property="og:${name}"]`).attr('content') ||
      $(`meta[property="twitter:${name}"]`).attr('content') ||
      '';

    const raw = {
      title: $('title').text() || getMeta('title') || 'No title available',
      description:
        getMeta('description') || $('meta[name="description"]').attr('content') || 'No description available',
      image:
        getMeta('image') ||
        $('meta[property="og:image"]').attr('content') ||
        $('meta[property="twitter:image"]').attr('content') ||
        '',
      keywords: getMeta('keywords') || '',
      siteName: getMeta('site_name') || new URL(url).hostname,
      url
    };

    res.json({ success: true, metadata: raw });
    return;
  } catch (error: any) {
    console.error('❌ Metadata fetch error:', error?.message);

    const fallback = {
      title: 'No title available',
      description: 'No description available',
      image: '',
      keywords: '',
      siteName: (() => {
        try {
          return new URL(req.body?.url).hostname;
        } catch {
          return '';
        }
      })(),
      url: req.body?.url ?? ''
    };

    res.json({ success: false, metadata: fallback, message: 'Using fallback metadata' });
    return;
  }
});

export default router;
