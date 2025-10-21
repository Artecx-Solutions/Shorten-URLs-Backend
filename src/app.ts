import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { connectDBWithTimeout, dbStatus } from './config/database';
import linkRoutes from './routes/links';
import authRoutes from './routes/auth';
import metadataRoutes from './routes/metadata';
import { errorHandler, notFound } from './middleware/errorHandler';

config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Ensure JWT_SECRET is set (dev convenience)
if (!process.env.JWT_SECRET) {
  console.log('⚠️ JWT_SECRET not set, using default (NOT SECURE FOR PRODUCTION)');
  process.env.JWT_SECRET = 'default-jwt-secret-change-in-production';
}

// Basic env diagnostics
console.log('🔍 Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'fallback in use');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'not set');
console.log('- Current working directory:', process.cwd());
console.log('- Node version:', process.version);

/**
 * CORS
 */
const DEFAULT_SWA_ORIGIN = 'https://zealous-mushroom-0c6dc3200.3.azurestaticapps.net';
const allowedOrigins =
  (process.env.CORS_ORIGINS ?? DEFAULT_SWA_ORIGIN)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const originMatchers = [
  /^https:\/\/[a-z0-9-]+\.3\.azurestaticapps\.net$/,
  /^http:\/\/localhost:\d+$/,
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (originMatchers.some(rx => rx.test(origin))) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept','Origin'],
  optionsSuccessStatus: 204,
};

// 1) CORS must be first
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 2) Security headers
app.use(helmet());

// 3) JSON body parsing
app.use(express.json());

// 4) Health route (keep above catch-alls)
app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    database: dbStatus(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins,
  });
});

// 5) Explicit favicon (prevents /:shortCode from grabbing it)
app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

// (Optional) robots.txt to reduce noise from crawlers
app.get('/robots.txt', (_req: Request, res: Response) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /');
});

// 6) API routes
app.use('/api/links', linkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/metadata', metadataRoutes);

// 7) Short-code redirect (regex avoids matching assets like .ico, .png, etc.)
/**
 * Valid short codes: 4–32 chars, letters, numbers, _ or -
 * Example: /abc123, /X_y-9
 */
app.get('/:shortCode([A-Za-z0-9_-]{4,32})', async (
  req: Request<{ shortCode: string }>,
  res: Response
): Promise<void> => {
  try {
    const { shortCode } = req.params;

    // Skip anything that looks like a file (defense-in-depth)
    if (shortCode.includes('.')) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }

    // Only query if DB is connected; otherwise clean 503 instead of exploding
    if (dbStatus() !== 'Connected') {
      res.status(503).json({ success: false, message: 'Database unavailable. Please try again shortly.' });
      return;
    }

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
  } catch (error) {
    console.error('❌ Root redirect error:', error);
    res.status(500).json({ success: false, message: 'Server error while redirecting' });
  }
});

// 8) Test route (quick smoke test)
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

// 9) Root info
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    message: 'Link Shortener API is running!',
    database: `Current: ${dbStatus()}`,
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

// 10) 404 + error handler
app.use(notFound);
app.use(errorHandler);

// --- Server bootstrap strategy ---
//  - Start HTTP server immediately so Azure sees a live endpoint (prevents 504 on cold boot)
//  - Attempt DB connection in the background with a hard timeout
//  - Log mode (FULL vs LIMITED) and keep serving /health, /, and API that don't require DB
const server = app.listen(PORT, () => {
  console.log(`\n🚀 HTTP server listening on :${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Optional: tune keep-alives (helps behind Azure Front Door on long connections)
server.keepAliveTimeout = 75_000;  // 75s
server.headersTimeout   = 90_000;  // must be > keepAliveTimeout

(async () => {
  try {
    console.log('🔄 Connecting to MongoDB (with timeout)...');
    await connectDBWithTimeout(12_000); // 12s hard cap
    console.log('✅ MongoDB connected. Running in FULL MODE.');
  } catch (err) {
    console.error('⚠️ MongoDB connection failed or timed out. Running in LIMITED MODE.', err);
  }
})();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  process.exit(0);
});

export default app;
