import mongoose from 'mongoose';

const FALLBACK_URI =
  'mongodb+srv://linkshortner:m1lk1$P01$0n@link-shortener.global.mongocluster.cosmos.azure.com/link-shortener?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000';

const uri = process.env.MONGODB_URI || FALLBACK_URI;

/**
 * Reasonable, Cosmos-friendly Mongoose options.
 * - Short server selection/connect timeouts to avoid long hangs
 * - IPv4 only (sometimes helps in restricted networks)
 * - Small pool to start with
 */
const mongooseOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10000, // 10s to find a server
  connectTimeoutMS: 10000,         // 10s TCP connect timeout
  socketTimeoutMS: 45000,          // 45s idle socket timeout
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 0,
  retryWrites: false as any,       // already disabled in URI, but keep explicit
  family: 4,                       // prefer IPv4
};

/**
 * Connect with a hard, overall timeout.
 * If connection can't be established quickly, we reject so the app can decide to run in LIMITED MODE.
 */
export async function connectDBWithTimeout(overallMs = 12000): Promise<typeof mongoose> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), overallMs);

  try {
    // @ts-expect-error AbortSignal is not typed in older Mongoose versions; runtime works in Node 18/20+
    const conn = await mongoose.connect(uri, { ...mongooseOptions, signal: controller.signal });
    return conn;
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Optional: expose a quick status helper */
export function dbStatus(): 'Connected' | 'Disconnected' {
  return mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
}
