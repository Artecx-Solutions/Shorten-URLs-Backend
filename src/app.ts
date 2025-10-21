import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { connectDB } from './config/database';
import linkRoutes from './routes/links';
import authRoutes from './routes/auth';
import metadataRoutes from './routes/metadata';
import { errorHandler, notFound } from './middleware/errorHandler';

config();

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * CORS
 * - If CORS_ORIGINS is missing, we default to your SPA origin (Azure Static Web Apps).
 * - To allow multiple origins, set CORS_ORIGINS to a comma-separated list.
 * - For local dev, you can include http://localhost:5173 in CORS_ORIGINS.
 */
const DEFAULT_SWA_ORIGIN = 'https://zealous-mushroom-0c6dc3200.3.azurestaticapps.net';
const allowedOrigins =
  (process.env.CORS_ORIGINS ?? DEFAULT_SWA_ORIGIN)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server or same-origin
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') {
      return cb(null, true);
    }
    return allowedOrigins.includes(origin)
      ? cb(null, true)
      : cb(new Error('Not allowed by CORS'));
  },
  credentials: true, // only if you actually send cookies/Authorization from SPA
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 204, // some browsers expect 204 for preflight
};

// CORS should be the first middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


// 2) Security headers
app.use(helmet());

// 3) JSON body parsing
app.use(express.json());

// 4) API routes
app.use('/api/links', linkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/metadata', metadataRoutes);

// 5) Root-level redirect for short codes (e.g., GET /abc123)
app.get('/:shortCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortCode } = req.params;
    const { Link } = await import('./models/Link'); // typed model

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
    // eslint-disable-next-line no-console
    console.error('❌ Root redirect error:', error);
    res.status(500).json({ success: false, message: 'Server error while redirecting' });
    return;
  }
});

// 6) Health (DB status)
app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const mongoose = await import('mongoose');
  const dbStatus = mongoose.default.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  res.json({
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins,
  });
  return;
});

// 7) Test route (quick smoke test)
app.get('/api/test', (_req: Request, res: Response): void => {
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
    ],
  });
});

// 8) Root info
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    message: 'Link Shortener API is running!',
    database: 'Check /health for database status',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        signup: 'POST /api/auth/signup',
        getProfile: 'GET /api/auth/me',
      },
      links: {
        createLink: 'POST /api/links/shorten',
        getUserLinks: 'GET /api/links/my-links',
        getAnalytics: 'GET /api/links/analytics/:shortCode',
        deleteLink: 'DELETE /api/links/:shortCode',
        getLinkInfo: 'GET /api/links/:shortCode',
      },
      redirect: 'GET /:shortCode',
    },
  });
});

// 9) 404 + error handler
app.use(notFound);
app.use(errorHandler);

// 10) Server bootstrap
const startServer = async (): Promise<void> => {
  try {
    // eslint-disable-next-line no-console
    console.log('🔄 Attempting to connect to MongoDB...');
    await connectDB();

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`\n🎉 Link Shortener Backend Started on http://localhost:${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`CORS allowing origins: ${allowedOrigins.join(', ') || '(all via reflect)'}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Failed to start server due to MongoDB connection issue');
    // eslint-disable-next-line no-console
    console.log('\n🚀 Starting server in LIMITED MODE (No MongoDB)...');
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`\n⚠️ Server running in LIMITED MODE on http://localhost:${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`CORS allowing origins: ${allowedOrigins.join(', ') || '(all via reflect)'}`);
    });
  }
};

process.on('SIGINT', async () => {
  // eslint-disable-next-line no-console
  console.log('\n⚠️ Shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;
