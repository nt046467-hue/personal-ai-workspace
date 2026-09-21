import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  jwtSecret: string;
  storageDir: string;
  dbPath: string;
  aiProvider: 'local' | 'openai' | 'anthropic' | 'gemini' | 'ollama';
  aiApiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  appOrigins: string[];
  seedDemo: boolean;
}

import crypto from 'crypto';

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
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage'),
  dbPath: path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage', 'myspace.sqlite'),
  aiProvider: (process.env.AI_PROVIDER as ServerConfig['aiProvider']) || 'local',
  aiApiKey: process.env.AI_API_KEY || undefined,
  aiModel: process.env.AI_MODEL || undefined,
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
  appOrigins: (process.env.APP_ORIGIN || 'http://localhost:5173,http://localhost:3001,http://127.0.0.1:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  seedDemo: process.env.SEED_DEMO === 'true',
};
