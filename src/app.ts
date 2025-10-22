import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { connectDBWithTimeout, dbReady } from './config/database';
import linkRoutes from './routes/links';
import authRoutes from './routes/auth';
import metadataRoutes from './routes/metadata';
import { errorHandler, notFound } from './middleware/errorHandler';

config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET) {
  console.log('⚠️ JWT_SECRET not set, using default (NOT SECURE FOR PRODUCTION)');
  process.env.JWT_SECRET = 'default-jwt-secret-change-in-production';
}

console.log('🔍 Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'fallback in use');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'not set');
console.log('- CWD:', process.cwd());
console.log('- Node:', process.version);

/** CORS */
const DEFAULT_SWA_ORIGIN = 'https://zealous-mushroom-0c6dc3200.3.azurestaticapps.net';
const allowedOrigins =
  (process.env.CORS_ORIGINS ?? DEFAULTSWA()).split(',').map(s => s.trim()).filter(Boolean);
function DEFAULTSWA() { return DEFAULT_SWA_ORIGIN; }
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
app.use(cors(corsOptions));
app.options('(.*)', cors(corsOptions));


app.use(helmet());
app.use(express.json());

/** health first */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    database: dbReady() ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins,
  });
});

app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /'));

/** API routes */
app.use('/api/links', linkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/metadata', metadataRoutes);

/** Short code redirect */
app.get('/:shortCode([A-Za-z0-9_-]{4,32})', async (
  req: Request<{ shortCode: string }>,
  res: Response
) => {
  try {
    const { shortCode } = req.params;
    if (shortCode.includes('.')) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }
    if (!dbReady()) {
      res.status(503).json({ success: false, message: 'Database unavailable. Please try again shortly.' });
      return;
    }
    const { Link } = await import('./models/Link');
    const link = await Link.findOne({ shortCode, isActive: true });
    if (!link) { res.status(404).json({ success: false, message: 'Short URL not found' }); return; }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ success: false, message: 'This short URL has expired' });
      return;
    }
    link.clicks += 1; await link.save();
    res.redirect(link.originalUrl);
  } catch (err) {
    console.error('❌ Root redirect error:', err);
    res.status(500).json({ success: false, message: 'Server error while redirecting' });
  }
});

/** Smoke test + root */
app.get('/api/test', (_req, res) => {
  res.json({ message: 'Backend is working!', timestamp: new Date().toISOString() });
});
app.get('/', (_req, res) => {
  res.json({
    message: 'Link Shortener API is running!',
    database: dbReady() ? 'Connected' : 'Disconnected',
    endpoints: { health: 'GET /health', test: 'GET /api/test', redirect: 'GET /:shortCode' }
  });
});

/** 404 + error handler */
app.use(notFound);
app.use(errorHandler);

/** Start HTTP immediately; connect DB in background */
const server = app.listen(PORT, () => {
  console.log(`\n🚀 HTTP server listening on :${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
server.keepAliveTimeout = 75000;
server.headersTimeout = 90000;

(async () => {
  try {
    console.log('🔄 Connecting to MongoDB (with timeout)…');
    await connectDBWithTimeout(12_000);
    console.log('✅ MongoDB connected. FULL MODE.');
  } catch (err) {
    console.error('⚠️ MongoDB connect failed/timed out. LIMITED MODE.', err);
  }
})();

/** Global handlers */
process.on('uncaughtException', (e) => console.error('💥 Uncaught Exception:', e));
process.on('unhandledRejection', (r,p) => console.error('💥 Unhandled Rejection at:', p, 'reason:', r));
process.on('SIGINT', () => { console.log('\n⚠️ Shutting down gracefully…'); process.exit(0); });

export default app;
