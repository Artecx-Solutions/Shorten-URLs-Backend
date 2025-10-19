// routes/links.ts
import express from 'express';
import { Link } from '../models/Link';
import { auth } from '../middleware/auth';
import { IUser } from '../models/User';
import validator from 'validator';

const router = express.Router();

// POST /api/links/shorten - Create short URL (Add this endpoint)
// routes/links.ts - Update the shorten endpoint
router.post('/shorten', async (req, res) => {
  try {
    console.log('📨 Received shorten request:', req.body);
    
    const { originalUrl, customAlias } = req.body;

    // Validate required fields
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Original URL is required'
      });
    }

    // Validate URL format
    if (!validator.isURL(originalUrl, {
      protocols: ['http', 'https'],
      require_tld: true,
      require_protocol: true,
    })) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format. Must include http:// or https://'
      });
    }

    // Check if custom alias is provided and available
    let shortCode;
    if (customAlias) {
      const existingLink = await Link.findOne({ 
        shortCode: customAlias
      });
      
      if (existingLink) {
        return res.status(400).json({
          success: false,
          message: 'Custom alias is already taken'
        });
      }
      shortCode = customAlias;
    } else {
      // Generate unique short code
      shortCode = generateShortCode();
      
      // Ensure uniqueness
      let existingLink = await Link.findOne({ shortCode });
      while (existingLink) {
        shortCode = generateShortCode();
        existingLink = await Link.findOne({ shortCode });
      }
    }

    // For now, create link as anonymous
    // You can add authentication later
    const link = new Link({
      originalUrl,
      shortCode,
      createdBy: 'anonymous' // This will work with Mixed type
    });

    await link.save();

    // Return the shortened URL
    const shortUrl = `${req.protocol}://${req.get('host')}/redirect/${link.shortCode}`;

    console.log('✅ URL shortened successfully:', shortUrl);

    res.status(201).json({
      success: true,
      message: 'URL shortened successfully',
      data: {
        originalUrl: link.originalUrl,
        shortUrl: shortUrl,
        shortCode: link.shortCode,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt
      }
    });

  } catch (error: any) {
    console.error('❌ URL shortening error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Short code already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((err: any) => err.message).join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while shortening URL'
    });
  }
});
// GET /api/links/:shortCode - Get URL info (Add this endpoint)
// GET /redirect/:shortCode - Redirect to original URL
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    console.log(`🔗 Redirect request for short code: ${shortCode}`);

    // Find the link by short code
    const link = await Link.findOne({ 
      shortCode,
      isActive: true 
    });

    if (!link) {
      console.log('❌ Link not found for short code:', shortCode);
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    // Check if link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      console.log('❌ Link expired:', shortCode);
      return res.status(410).json({
        success: false,
        message: 'This short URL has expired'
      });
    }

    // Increment click count
    link.clicks += 1;
    await link.save();

    console.log(`✅ Redirecting ${shortCode} to: ${link.originalUrl}`);
    console.log(`📊 Click count updated to: ${link.clicks}`);

    // Redirect to the original URL
    res.redirect(link.originalUrl);

  } catch (error) {
    console.error('❌ Redirect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while redirecting'
    });
  }
});

// Get all links for authenticated user (Your existing endpoint)
router.get('/my-links', auth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const links = await Link.find({ createdBy: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Link.countDocuments({ createdBy: user._id });
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: links,
      pagination: {
        currentPage: page,
        totalPages,
        totalLinks: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user links error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching links'
    });
  }
});

// Get link analytics (Your existing endpoint)
router.get('/analytics/:shortCode', auth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { shortCode } = req.params;

    const link = await Link.findOne({ 
      shortCode, 
      createdBy: user._id 
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Link not found'
      });
    }

    res.json({
      success: true,
      data: link
    });
  } catch (error) {
    console.error('Get link analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics'
    });
  }
});

// Delete a link (Your existing endpoint)
router.delete('/:shortCode', auth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { shortCode } = req.params;

    const link = await Link.findOneAndDelete({ 
      shortCode, 
      createdBy: user._id 
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Link not found'
      });
    }

    res.json({
      success: true,
      message: 'Link deleted successfully'
    });
  } catch (error) {
    console.error('Delete link error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting link'
    });
  }
});

// Helper function to generate short code
function generateShortCode(): string {
  return Math.random().toString(36).substring(2, 8);
}

// Add this route to your existing links.ts file
router.get('/delay/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    console.log(`⏳ Delay request for short code: ${shortCode}`);

    const link = await Link.findOne({ 
      shortCode,
      isActive: true 
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    // Check if link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This short URL has expired'
      });
    }

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

  } catch (error) {
    console.error('❌ Get link for delay error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching link information'
    });
  }
});

export default router;