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

config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/links', linkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/redirect', redirectRoutes);

// Root-level redirect (keep this if you want `/abc123` to redirect)
app.get('/:shortCode', async (req, res): Promise<void> => {
  try {
    const { shortCode } = req.params;
    const { Link } = await import('./models/Link');

    const link = await Link.findOne({ shortCode, isActive: true });
    if (!link) {
      res.status(404).json({ success: false, message: 'Short URL not found' });
      return;
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ success: false, message: 'This short URL has expired' });
      return;
    }

    link.clicks += 1;
    await link.save();
    res.redirect(link.originalUrl);
    return;
  } catch (error) {
    console.error('❌ Root redirect error:', error);
    res.status(500).json({ success: false, message: 'Server error while redirecting' });
    return;
  }
});

// Health
app.get('/health', async (_req, res): Promise<void> => {
  const mongoose = await import('mongoose');
  const dbStatus = mongoose.default.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  res.json({
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
  return;
});

// Test
app.get('/api/test', (_req, res): void => {
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
      '/:shortCode',
      '/redirect/:shortCode'
    ]
  });
});

// Root info
app.get('/', (_req, res): void => {
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
      redirect: 'GET /:shortCode'
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    await connectDB();

    app.listen(PORT, () => {
      console.log(`\n🎉 Link Shortener Backend Started on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('\n❌ Failed to start server due to MongoDB connection issue');
    console.log('\n🚀 Starting server in LIMITED MODE (No MongoDB)...');
    app.listen(PORT, () => {
      console.log(`\n⚠️ Server running in LIMITED MODE on http://localhost:${PORT}`);
    });
  }
};

process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  process.exit(0);
});

startServer();