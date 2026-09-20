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
}

export const config: ServerConfig = {
  env: (process.env.NODE_ENV as ServerConfig['env']) || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'myspace-ai-fallback-secret-key-32-chars-minimum',
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage'),
  dbPath: path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage', 'myspace.sqlite'),
  aiProvider: (process.env.AI_PROVIDER as ServerConfig['aiProvider']) || 'local',
  aiApiKey: process.env.AI_API_KEY || undefined,
  aiModel: process.env.AI_MODEL || undefined,
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
};
