import mongoose from 'mongoose';

const FALLBACK_URI =
  'mongodb+srv://linkshortner:m1lk1$P01$0n@link-shortener.global.mongocluster.cosmos.azure.com/link-shortener?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000';

const uri = process.env.MONGODB_URI || FALLBACK_URI;

const options: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  family: 4,
};

export async function connectDBWithTimeout(overallMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), overallMs);
  try {
    // @ts-ignore AbortSignal is supported at runtime
    return await mongoose.connect(uri, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function dbReady() {
  return mongoose.connection.readyState === 1;
}
