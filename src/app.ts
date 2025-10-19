import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { connectDB } from './config/database';
import linkRoutes from './routes/links';
import authRoutes from './routes/auth'; 
import { errorHandler, notFound } from './middleware/errorHandler';

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
app.use('/api/auth', authRoutes); // Add auth routes

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

// Basic route without DB dependency
app.get('/', (_req, res) => {
  res.json({
    message: 'Link Shortener API is running!',
    database: 'Check /health for database status',
    endpoints: {
      createLink: 'POST /api/links/shorten',
      redirect: 'GET /:shortCode',
      analytics: 'GET /api/links/analytics/:shortCode'
    }
  });
});

// Error handling
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
      console.log(`📊 API: http://localhost:${PORT}/api/links`);
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