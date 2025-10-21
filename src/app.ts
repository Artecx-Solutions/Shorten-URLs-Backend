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

// Ensure JWT_SECRET is set (dev convenience)
if (!process.env.JWT_SECRET) {
  console.log('⚠️ JWT_SECRET not set, using default (NOT SECURE FOR PRODUCTION)');
  process.env.JWT_SECRET = 'default-jwt-secret-change-in-production';
}

// Basic env diagnostics
console.log('🔍 Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'not set');
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
    const mongoose = await import('mongoose');
    if (mongoose.default.connection.readyState !== 1) {
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

// 10) 404 + error handler
app.use(notFound);
app.use(errorHandler);

// 11) Server bootstrap
// const startServer = async (): Promise<void> => {
//   try {
//     console.log('🚀 Starting server...');
//     console.log('🔄 Attempting to connect to MongoDB...');
//     await connectDB();

//     const server = app.listen(PORT, () => {
//       console.log(`\n🎉 Link Shortener Backend Started on port ${PORT}`);
//       console.log(`CORS allowing origins: ${allowedOrigins.join(', ') || '(all via reflect)'}`);
//       console.log(`Health check: http://localhost:${PORT}/health`);
//       console.log('✅ Server is ready to accept connections');
//     });

//     server.on('error', (error) => {
//       console.error('❌ Server error:', error);
//     });

//   } catch (error) {
//     console.error('\n❌ Failed to start server due to MongoDB connection issue:', error);
//     console.log('\n🚀 Starting server in LIMITED MODE (No MongoDB)...');

//     try {
//       const server = app.listen(PORT, () => {
//         console.log(`\n⚠️ Server running in LIMITED MODE on port ${PORT}`);
//         console.log(`CORS allowing origins: ${allowedOrigins.join(', ') || '(all via reflect)'}`);
//         console.log(`Health check: http://localhost:${PORT}/health`);
//         console.log('✅ Server is ready to accept connections (Limited Mode)');
//       });

//       server.on('error', (error) => {
//         console.error('❌ Server error in limited mode:', error);
//       });
//     } catch (startupError) {
//       console.error('💥 Critical startup error:', startupError);
//       process.exit(1);
//     }
//   }
// };
const startServer = async (): Promise<void> => {
  const PORT_TO_USE = Number(PORT);

  // small helper: promise timeout
  const withTimeout = <T,>(p: Promise<T>, ms: number, label = 'timeout'): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(label)), ms);
      p.then(v => { clearTimeout(t); resolve(v); })
       .catch(e => { clearTimeout(t); reject(e); });
    });

  // background retry for DB connection (runs if first attempt failed/timed out)
  const startDbRetryLoop = () => {
    let attempt = 0;
    const maxDelayMs = 60_000;

    const tryOnce = async () => {
      attempt += 1;
      const backoff = Math.min(1000 * Math.pow(2, attempt), maxDelayMs);

      try {
        console.log(`🔁 [DB] Retry attempt ${attempt}...`);
        await connectDB();
        console.log('✅ [DB] Connected after retry');
      } catch (err) {
        console.error(`❌ [DB] Retry failed (attempt ${attempt}):`, (err as Error)?.message || err);
        setTimeout(tryOnce, backoff);
      }
    };

    // kick off
    setTimeout(tryOnce, 3000);
  };

  try {
    console.log('🚀 Starting server...');
    console.log('🔄 Attempting initial MongoDB connection (with timeout)...');

    // Attempt DB connect, but don't let it block startup forever
    await withTimeout(connectDB(), 6000, 'DB connect timeout');

    // If we got here, DB connected quickly — start normally
    const server = app.listen(PORT_TO_USE, () => {
      console.log(`\n🎉 Link Shortener Backend Started on port ${PORT_TO_USE} (DB: connected)`);
      console.log(`CORS allowing origins: ${allowedOrigins.join(', ') || '(all via reflect)'}`);
      console.log(`Health check: http://localhost:${PORT_TO_USE}/health`);
      console.log('✅ Server is ready to accept connections');
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });

  } catch (error) {
    console.error('\n⚠️ Initial DB connect failed or timed out:', (error as Error)?.message || error);
    console.log('🚦 Starting server in LIMITED MODE (DB not ready)...');

    // Start server anyway so Azure doesn’t 504
    const server = app.listen(PORT_TO_USE, () => {
      console.log(`\n⚠️ Server running in LIMITED MODE on port ${PORT_TO_USE}`);
      console.log(`CORS allowing origins: ${allowedOrigins.join(', ') || '(all via reflect)'}`);
      console.log(`Health check: http://localhost:${PORT_TO_USE}/health`);
      console.log('✅ Server is ready to accept connections (Limited Mode)');
    });

    server.on('error', (error) => {
      console.error('❌ Server error in limited mode:', error);
    });

    // Keep trying to connect to DB in the background
    startDbRetryLoop();
  }
};

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.log('🔄 Continuing execution...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('🔄 Continuing execution...');
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;
