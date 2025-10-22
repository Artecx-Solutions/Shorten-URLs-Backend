import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
  ACCESS_TOKEN_TTL_MIN: Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15),
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*'
};
