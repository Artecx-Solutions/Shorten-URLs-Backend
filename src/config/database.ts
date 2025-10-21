import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

// MongoDB URI configuration for different environments
const MONGODB_URI = process.env.MONGODB_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'mongodb://localhost:27017/link-shortener' 
    : 'mongodb://localhost:27017/link-shortener');

// Alternative: Use MongoDB Memory Server for development
let isConnected = false;

export const connectDB = async (): Promise<void> => {
  try {
    if (isConnected) {
      return;
    }

    // Check if MONGODB_URI is provided
    if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017/link-shortener') {
      console.log('⚠️ No MongoDB URI provided, running in LIMITED MODE');
      return; // Don't exit, just skip database connection
    }

    await mongoose.connect(MONGODB_URI, {
      // Add connection options for better error handling
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverApi: {
        version: '1',
        strict: false,
        deprecationErrors: true,
      }
    });
    
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    console.log('⚠️ Continuing without database connection...');
    // Don't exit the process, let the app run in limited mode
  }
};