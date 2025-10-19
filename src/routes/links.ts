// routes/links.ts
import express from 'express';
import { Link } from '../models/Link';
import { auth } from '../middleware/auth';
import { IUser } from '../models/User';
import validator from 'validator';
import mongoose from 'mongoose';

const router = express.Router();

// POST /api/links/shorten - Create short URL
router.post('/shorten', auth, async (req: any, res) => {
  try {
    console.log('📨 Received shorten request:', req.body);
    console.log('👤 User making request:', req.user ? req.user._id : 'No user');
    
    const { originalUrl, customAlias, title, description } = req.body;
    const user = req.user; // User from auth middleware

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

    // Create new link with user ID if authenticated, otherwise use 'anonymous'
    const linkData: any = {
      originalUrl,
      shortCode,
      createdBy: user ? user._id.toString() : 'anonymous' // Save as string     
    };

    // Add optional fields if provided
    if (title) linkData.title = title;
    if (description) linkData.description = description;

    const link = new Link(linkData);
    await link.save();

    // Populate user info for response
    await link.populate('createdBy', 'name email');

    // Return the shortened URL
    const shortUrl = `${req.protocol}://${req.get('host')}/${link.shortCode}`;

    console.log('✅ URL shortened successfully:', {
      shortUrl,
      createdBy: user ? user._id : 'anonymous',
      shortCode: link.shortCode
    });

    res.status(201).json({
      success: true,
      message: 'URL shortened successfully',
      data: {
        originalUrl: link.originalUrl,
        shortUrl: shortUrl,
        shortCode: link.shortCode,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        createdBy: link.createdBy,
        title: link.title,
        description: link.description
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

// GET /api/links/delay/:shortCode - Get link info for delay page
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

// GET /api/links/:shortCode - Get URL info (for API calls)
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    console.log(`🔗 API info request for short code: ${shortCode}`);

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
        isActive: link.isActive
      }
    });
  } catch (error) {
    console.error('Get URL info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching URL info'
    });
  }
});

// Get all links for authenticated user
// GET /api/links/my-links - Get user's links

// Get link analytics
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

router.get('/my-links', auth, async (req: any, res) => {
  try {
    console.log('=== MY-LINKS REQUEST START ===');
    
    const user = req.user;
    
    if (!user) {
      console.log('❌ No user in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view your links'
      });
    }

    console.log('👤 User:', user._id, user.email);
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const userId = user._id.toString();
    console.log('🔍 Querying for user ID:', userId);

    // Simplified query - just use the string ID
    const query = { createdBy: userId };

    const [links, total] = await Promise.all([
      Link.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Link.countDocuments(query)
    ]);

    console.log('📊 Query results:', {
      linksFound: links.length,
      total: total,
      queryUsed: query
    });

    const totalPages = Math.ceil(total / limit);

    console.log('✅ Final result:', {
      links: links.length,
      total: total,
      pages: totalPages
    });
    console.log('=== MY-LINKS REQUEST END ===');

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
    console.error('❌ Get user links error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching links'
    });
  }
});

// Delete a link
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

export default router;