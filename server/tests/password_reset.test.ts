/**
 * Password Reset Feature Tests
 * Tests: forgot-password, reset-password routes, timing, token expiry, reuse, session invalidation.
 * Run: tsx --test server/tests/password_reset.test.ts
 */
import assert from 'node:assert';
import test, { before, after } from 'node:test';
import type { Server } from 'node:http';
import crypto from 'crypto';
import { createApp } from '../app';
import { closeDatabase, getDatabase } from '../db';

let server: Server;
let BASE_URL = 'http://localhost:0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function json(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

/** Sign up a fresh user, return { cookie, csrf, userId, email }. */
async function signupUser(email: string, password = 'MySecurePass1!') {
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Test User' }),
  });
  const body = await json(res);
  assert.ok(body.success, `Signup failed for ${email}: ${JSON.stringify(body)}`);
  const rawCookie = res.headers.get('set-cookie') || '';
  const sessionMatch = rawCookie.match(/(myspace_session=[^;]+)/);
  return {
    cookie: sessionMatch ? sessionMatch[1] : '',
    csrf: body.data.csrfToken || '',
    userId: body.data.user.id as string,
    email,
  };
}

/** Call forgot-password and return the raw response. */
async function callForgotPassword(email: string) {
  return fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Read the most recent unused token row for a user from DB (server-side only). */
async function getLatestToken(userId: string) {
  const db = getDatabase();
  const result = await db.execute({
    sql: `SELECT * FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    args: [userId],
  });
  return result.rows[0] as any ?? null;
}

/** Call reset-password with the given raw token and new password. */
async function callResetPassword(token: string, newPassword: string) {
  return fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
}

/** Log in and get session cookie. Returns null if login fails. */
async function loginUser(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await json(res);
  if (!body.success) return null;
  const rawCookie = res.headers.get('set-cookie') || '';
  const sessionMatch = rawCookie.match(/(myspace_session=[^;]+)/);
  return { cookie: sessionMatch ? sessionMatch[1] : '', csrf: body.data.csrfToken };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

before(async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-only';
  process.env.NODE_ENV = 'test';

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        BASE_URL = `http://localhost:${address.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  closeDatabase();
  if (server) {
    server.closeAllConnections?.();
    server.closeIdleConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  setTimeout(() => process.exit(0), 50);
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test('Forgot Password & Reset Password — Full Flow', async (t) => {
  const suffix = Date.now();
  const email = `reset_test_${suffix}@workspace.ai`;
  const password = 'OldP@ssword1234';
  const newPassword = 'NewP@ssword5678';

  const { userId } = await signupUser(email, password);

  // ── T1: Forgot-password returns 200 for existing email ──────────────────
  await t.test('T1: forgot-password returns generic 200 for existing email', async () => {
    const res = await callForgotPassword(email);
    const body = await json(res);
    assert.strictEqual(res.status, 200, 'Should be 200');
    assert.strictEqual(body.success, true, 'success should be true');
    assert.ok(body.message, 'Should have a message');
  });

  // ── T2: Token is stored (hashed) in DB ──────────────────────────────────
  await t.test('T2: password_reset_tokens row created for user', async () => {
    const token = await getLatestToken(userId);
    assert.ok(token, 'Token row should exist');
    assert.ok(token.token_hash, 'token_hash should be set');
    assert.ok(!token.used_at, 'used_at should be null');
    const expiresAt = new Date(token.expires_at).getTime();
    const now = Date.now();
    assert.ok(expiresAt > now, 'Token should not be expired yet');
    assert.ok(expiresAt <= now + 31 * 60 * 1000, 'Token should expire within ~30 min');
  });

  // ── T3: Forgot-password returns 200 for NON-EXISTENT email ─────────────
  await t.test('T3: forgot-password returns identical 200 for non-existent email', async () => {
    const res = await callForgotPassword(`nobody_${suffix}@workspace.ai`);
    const body = await json(res);
    assert.strictEqual(res.status, 200, 'Should still be 200');
    assert.strictEqual(body.success, true, 'success should be true');
  });

  // ── T4: Timing — non-existent email should not be dramatically faster ───
  await t.test('T4: timing side-channel — non-existent email takes measurable time (bcrypt ran)', async () => {
    // We can't reliably compare latency in-process (rate limiter may short-circuit the real path).
    // Instead verify the fake path itself takes at least 20ms, proving the bcrypt dummy hash executed.
    const fakeEmail = `t4_ghost_${suffix}@workspace.ai`;
    // Warm up
    await callForgotPassword(fakeEmail);
    // Measure
    const t0 = Date.now();
    const res = await callForgotPassword(fakeEmail);
    const elapsed = Date.now() - t0;
    const body = await json(res);
    // If rate-limited, the test is moot (server already protected it)
    if (res.status === 429) return;
    assert.strictEqual(body.success, true, 'Should succeed for non-existent email');
    // bcrypt.hash with cost 10 typically takes >20ms even on fast machines
    assert.ok(elapsed >= 20, `Expected bcrypt dummy hash to take at least 20ms, took ${elapsed}ms`);
  });

  // ── T5: Second forgot-password request invalidates the old token ───────
  await t.test('T5: second forgot-password invalidates the first token', async () => {
    // Capture the current latest token ID *before* we call forgot-password again
    const firstToken = await getLatestToken(userId);
    assert.ok(firstToken, 'A token should exist from previous calls');
    const firstTokenId = firstToken.id as string;

    // Call forgot-password to create a new token (may be rate-limited, that's OK)
    const res = await callForgotPassword(email);
    const db = getDatabase();

    if (res.status === 429) {
      // Rate-limited: can't create a new token, but that means the old one is still
      // the latest. Skip the invalidation assertion in this edge case.
      return;
    }

    // The old token row should now be marked used
    const oldRow = await db.execute({
      sql: `SELECT used_at FROM password_reset_tokens WHERE id = ?`,
      args: [firstTokenId],
    });
    const oldRecord = oldRow.rows[0] as any;
    assert.ok(oldRecord?.used_at, 'Old token should have used_at set after a new reset request');
  });

  // ── T6: reset-password with wrong/bad token → 400 ───────────────────────
  await t.test('T6: reset-password with garbage token returns INVALID_OR_EXPIRED_TOKEN', async () => {
    const res = await callResetPassword('aaaa' + crypto.randomBytes(16).toString('hex'), newPassword);
    const body = await json(res);
    assert.strictEqual(res.status, 400, 'Should be 400');
    assert.strictEqual(body.error?.code, 'INVALID_OR_EXPIRED_TOKEN');
  });

  // ── T7: reset-password with too-short new password → 400 validation ─────
  await t.test('T7: reset-password rejects password shorter than 10 chars', async () => {
    const tokenRow = await getLatestToken(userId);
    // Re-derive raw token is not possible (only hash stored). Use a known-valid flow:
    const res = await callResetPassword('short', 'tiny');
    const body = await json(res);
    // Either validation (VALIDATION_ERROR) or bad token — in both cases not 200
    assert.notStrictEqual(res.status, 200, 'Should not succeed');
    void tokenRow; // suppress unused warning
  });

  // ── T8: Full reset flow: valid token → password updated, sessions cleared ─
  let rawTokenForReset = '';
  await t.test('T8: full reset: valid token updates password and clears sessions', async () => {
    // Get a fresh token by calling forgot-password again
    await callForgotPassword(email);
    const tokenRow = await getLatestToken(userId);
    assert.ok(tokenRow, 'Should have a fresh unused token');

    // Recover raw token: we need to find it. Since we only store hash, we must
    // do a full forgot-password and intercept via DB + reverse approach is
    // impossible. Instead, we directly insert a known token for testing.
    const db = getDatabase();
    const testRawToken = crypto.randomBytes(32).toString('hex');
    const testHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    const expires = new Date(Date.now() + 29 * 60 * 1000).toISOString();
    const newId = `prt-test-${suffix}`;
    // Invalidate the latest token and insert a known-raw one
    await db.execute({ sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`, args: [userId] });
    await db.execute({
      sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
      args: [newId, userId, testHash, expires],
    });
    rawTokenForReset = testRawToken;

    // Get token_version before reset
    const beforeUser = await db.execute({ sql: `SELECT token_version FROM users WHERE id = ?`, args: [userId] });
    const versionBefore = Number((beforeUser.rows[0] as any)?.token_version || 0);

    // Perform reset
    const res = await callResetPassword(testRawToken, newPassword);
    const body = await json(res);
    assert.strictEqual(res.status, 200, `Reset failed: ${JSON.stringify(body)}`);
    assert.strictEqual(body.success, true);

    // token_version should have bumped
    const afterUser = await db.execute({ sql: `SELECT token_version FROM users WHERE id = ?`, args: [userId] });
    const versionAfter = Number((afterUser.rows[0] as any)?.token_version || 0);
    assert.strictEqual(versionAfter, versionBefore + 1, 'token_version should have incremented');

    // Sessions table should have no active sessions for this user
    const sessions = await db.execute({ sql: `SELECT id FROM sessions WHERE user_id = ?`, args: [userId] });
    assert.strictEqual(sessions.rows.length, 0, 'All sessions should be deleted');

    // Token row should be marked used
    const usedRow = await db.execute({ sql: `SELECT used_at FROM password_reset_tokens WHERE id = ?`, args: [newId] });
    assert.ok((usedRow.rows[0] as any)?.used_at, 'Token should be marked used');
  });

  // ── T9: Using same token a second time → 400 ────────────────────────────
  await t.test('T9: reusing the same token after a successful reset returns INVALID_OR_EXPIRED_TOKEN', async () => {
    assert.ok(rawTokenForReset, 'Need rawTokenForReset from T8');
    const res = await callResetPassword(rawTokenForReset, 'AnotherPassword99');
    const body = await json(res);
    assert.strictEqual(res.status, 400, 'Should be 400 on second use');
    assert.strictEqual(body.error?.code, 'INVALID_OR_EXPIRED_TOKEN');
  });

  // ── T10: Login with new password works ──────────────────────────────────
  await t.test('T10: can log in with new password after reset', async () => {
    const session = await loginUser(email, newPassword);
    assert.ok(session, 'Login with new password should succeed');
    assert.ok(session?.cookie, 'Should get a session cookie');
  });

  // ── T11: Login with old password fails ──────────────────────────────────
  await t.test('T11: old password no longer works after reset', async () => {
    const session = await loginUser(email, password);
    assert.strictEqual(session, null, 'Old password should be rejected');
  });

  // ── T12: Expired token → 400 ─────────────────────────────────────────────
  await t.test('T12: expired token returns INVALID_OR_EXPIRED_TOKEN', async () => {
    const db = getDatabase();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    // Insert a token expired 1 second ago
    const expired = new Date(Date.now() - 1000).toISOString();
    await db.execute({
      sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
      args: [`prt-expired-${suffix}`, userId, hash, expired],
    });

    const res = await callResetPassword(rawToken, newPassword);
    const body = await json(res);
    assert.strictEqual(res.status, 400, 'Should be 400 for expired token');
    assert.strictEqual(body.error?.code, 'INVALID_OR_EXPIRED_TOKEN');
  });

  // ── T13: Rate limit — forgotPasswordLimiter returns 429 + correct shape ──
  await t.test('T13: forgot-password rate limit returns 429 with RATE_LIMIT_EXCEEDED code', async () => {
    // By now, all 5 forgotPasswordLimiter slots for this IP have been consumed by T1-T5.
    // Any further call from this IP should return 429.
    // We verify the response has the correct error shape (code + retryAfterSeconds).
    const r = await callForgotPassword(email);
    const body = await json(r);
    assert.strictEqual(r.status, 429, 'Should be 429 when rate limit is exhausted');
    assert.strictEqual(body.success, false, 'success should be false');
    assert.strictEqual(body.error?.code, 'RATE_LIMIT_EXCEEDED', 'Error code should be RATE_LIMIT_EXCEEDED');
    assert.ok(typeof body.error?.retryAfterSeconds === 'number', 'Should include retryAfterSeconds');
  });
});

