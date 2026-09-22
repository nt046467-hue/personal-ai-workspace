import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  jwtSecret: string;
  tursoDatabaseUrl: string;
  tursoAuthToken?: string;
  blobReadWriteToken?: string;
  appEncryptionKey?: string;
  appOrigin: string;
  storageDir: string;
  dbPath: string;
  aiProvider: 'local' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'groq';
  aiApiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  aiDailyCapDefault: number;
  appOrigins: string[];
  seedDemo: boolean;
  resendApiKey?: string;
  emailFrom: string;
}

const env = (process.env.NODE_ENV as ServerConfig['env']) || 'development';

if (env === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: In production, JWT_SECRET must be set and at least 32 characters.');
  }
}

let jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  if (env !== 'test') {
    console.warn('[Config] No JWT_SECRET provided. Generated an ephemeral per-boot secret for development.');
  }
}

export const config: ServerConfig = {
  env,
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret,
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL || '',
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN || undefined,
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY || undefined,
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage'),
  dbPath: path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage', 'myspace.sqlite'),
  aiProvider: (process.env.AI_PROVIDER as ServerConfig['aiProvider']) || 'local',
  aiApiKey: process.env.AI_API_KEY || undefined,
  aiModel: process.env.AI_MODEL || undefined,
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
  aiDailyCapDefault: parseInt(process.env.AI_DAILY_CAP_DEFAULT || '20', 10),
  appOrigins: [
    ...(process.env.APP_ORIGIN || 'http://localhost:5173,http://localhost:3001,http://127.0.0.1:5173')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
    'https://myspace.nabint.com.np',
  ],
  seedDemo: process.env.SEED_DEMO === 'true',
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM || 'MySpace AI <onboarding@resend.dev>',
};
