-- Migration: 003_ai_settings.sql
-- Adds per-user BYOK settings and daily usage tracking for shared operator key

CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT,                 -- 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | NULL
  model TEXT,
  base_url TEXT,
  api_key_enc TEXT,              -- AES-256-GCM ciphertext, base64: iv:authTag:ciphertext
  daily_cap INTEGER,             -- max requests/day against the OPERATOR key when this user has
                                  -- no key of their own; NULL = use the global default cap
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,             -- 'YYYY-MM-DD' (UTC)
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
