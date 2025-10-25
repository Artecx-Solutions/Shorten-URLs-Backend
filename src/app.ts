import express = require('express');
import cookieParser = require('cookie-parser');
import cors = require('cors');
import helmet from 'helmet';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import linkRoutes from './routes/link.routes';
import metadataRoutes from './routes/metadata.routes';
import adminUsersRoutes from './routes/admin.users.routes';
import adminLinksRoutes from './routes/admin.links.routes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/links', adminLinksRoutes);

// 404 + error
app.use(notFound);
app.use(errorHandler);

export default app;