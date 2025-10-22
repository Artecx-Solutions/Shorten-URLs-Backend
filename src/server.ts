import { env } from './config/env';
import { connectDB } from './config/database';
import app from './app';

async function main() {
  await connectDB(env.MONGODB_URI);
  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  });
}
main().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
