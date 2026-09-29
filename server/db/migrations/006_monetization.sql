-- Migration 006: Monetization — tier system, payment claims
-- Adds `tier` and daily AI call tracking to users table,
-- and creates the payment_claims table for manual approval flow.

-- Add tier column to users (free or founder)
ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free';

-- Add per-user daily AI call tracking (for founder 50-call cap using hosted key)
ALTER TABLE users ADD COLUMN ai_calls_today INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN ai_calls_reset_at TEXT;

-- Payment claims: stores manual payment submissions pending admin approval
CREATE TABLE IF NOT EXISTS payment_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  reference TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_payment_claims_user ON payment_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_claims_status ON payment_claims(status, created_at DESC);
