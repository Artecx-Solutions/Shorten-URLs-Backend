// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { connectDB } from './config/database';
import linkRoutes from './routes/links';
import authRoutes from './routes/auth'; 
import redirectRoutes from './routes/links';
import { errorHandler, notFound } from './middleware/errorHandler';
import metadataRoutes from './routes/metadata';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/links', linkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/redirect', redirectRoutes); // Keep this for backward compatibility

// NEW: Handle root-level redirects (e.g., /zdkbs8)
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    console.log(`🔗 Root-level redirect for short code: ${shortCode}`);

    // Import Link model
    const { Link } = await import('./models/Link');
    
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
    console.error('❌ Root redirect error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while redirecting'
    });
  }
});

// Health check with DB status
app.get('/health', async (_req, res) => {
  const mongoose = await import('mongoose');
  const dbStatus = mongoose.default.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.json({ 
    status: 'OK', 
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route to verify all endpoints
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    availableRoutes: [
      '/api/auth/login',
      '/api/auth/signup', 
      '/api/auth/me',
      '/api/links/shorten',
      '/api/links/my-links',
      '/api/links/analytics/:shortCode',
      '/api/links/:shortCode',
      '/:shortCode', // NEW: Root-level redirects
      '/redirect/:shortCode' // Keep for backward compatibility
    ]
  });
});

// Basic route without DB dependency
app.get('/', (req, res) => {
  res.json({ 
    message: 'Link Shortener API is running!',
    database: 'Check /health for database status',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        signup: 'POST /api/auth/signup',
        getProfile: 'GET /api/auth/me'
      },
      links: {
        createLink: 'POST /api/links/shorten',
        getUserLinks: 'GET /api/links/my-links',
        getAnalytics: 'GET /api/links/analytics/:shortCode',
        deleteLink: 'DELETE /api/links/:shortCode',
        getLinkInfo: 'GET /api/links/:shortCode'
      },
      redirect: 'GET /:shortCode' // UPDATED: Now at root level
    }
  });
});

// Error handling - make sure this comes AFTER all routes
app.use(notFound);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`\n🎉 Link Shortener Backend Started!`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`🔍 Health: http://localhost:${PORT}/health`);
      console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
      console.log(`\n📊 Available Routes:`);
      console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth`);
      console.log(`   🔗 Links: http://localhost:${PORT}/api/links`);
      console.log(`   🔄 Redirect: http://localhost:${PORT}/:shortCode (NEW!)`);
    });
    
  } catch (error) {
    console.error('\n❌ Failed to start server due to MongoDB connection issue');
    console.log('\n🚀 Starting server in limited mode (API will work but data wont persist)...');
    
    // Start server even without MongoDB (for development)
    app.listen(PORT, () => {
      console.log(`\n⚠️ Server running in LIMITED MODE (No MongoDB)`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`💡 Fix: Start MongoDB service and restart server`);
    });
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  process.exit(0);
});

startServer();