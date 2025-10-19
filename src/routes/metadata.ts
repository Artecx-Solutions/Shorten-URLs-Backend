// routes/metadata.ts
import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = express.Router();

// POST /api/metadata - Fetch metadata from URL
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    console.log('🔍 Fetching metadata for:', url);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    const $ = cheerio.load(response.data);

    // Extract metadata
    const getMetaContent = (name: string) => {
      return $(`meta[name="${name}"]`).attr('content') ||
             $(`meta[property="og:${name}"]`).attr('content') ||
             $(`meta[property="twitter:${name}"]`).attr('content') ||
             '';
    };

    const metadata = {
      title: $('title').text() || getMetaContent('title') || 'No title available',
      description: getMetaContent('description') || 
                  $('meta[name="description"]').attr('content') ||
                  'No description available',
      image: getMetaContent('image') || 
             $('meta[property="og:image"]').attr('content') ||
             $('meta[property="twitter:image"]').attr('content') ||
             '',
      keywords: getMetaContent('keywords') || '',
      siteName: getMetaContent('site_name') || new URL(url).hostname,
      url: url
    };

    console.log('✅ Metadata extracted:', {
      title: metadata.title.substring(0, 50) + '...',
      description: metadata.description.substring(0, 50) + '...',
      hasImage: !!metadata.image
    });

    res.json({
      success: true,
      metadata
    });

  } catch (error: any) {
    console.error('❌ Metadata fetch error:', error.message);
    
    // Return basic metadata even if fetch fails
    const fallbackMetadata = {
      title: 'No title available',
      description: 'No description available',
      image: '',
      keywords: '',
      siteName: new URL(req.body.url).hostname,
      url: req.body.url
    };

    res.json({
      success: false,
      metadata: fallbackMetadata,
      message: 'Using fallback metadata'
    });
  }
});

export default router;