import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

// For development without MongoDB installation
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/link-shortener';

// Alternative: Use MongoDB Memory Server for development
let isConnected = false;

export const connectDB = async (): Promise<void> => {
  try {
    if (isConnected) {
      return;
    }

    await mongoose.connect(MONGODB_URI, {
      // Add connection options for better error handling
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    
    // Provide helpful error message
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure MongoDB is installed');
    console.log('2. Start MongoDB service:');
    console.log('   - Windows: net start MongoDB');
    console.log('   - macOS: brew services start mongodb-community'); 
    console.log('   - Linux: sudo systemctl start mongod');
    console.log('3. Or download MongoDB from: https://www.mongodb.com/try/download/community');
    
    process.exit(1);
  }
};