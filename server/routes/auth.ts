import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { generateAccessToken, generateRefreshToken } from '../auth/jwt';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { signupSchema, loginSchema, profileSchema } from '../validation/schemas';
import { config } from '../config';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

async function setAuthCookies(
  res: Response, 
  user: { id: string; email: string; name: string; role: string; tokenVersion: number }, 
  workspaceId: string
): Promise<string> {
  const db = getDatabase();

  // 1. Short-lived 15-minute access token
  const accessToken = generateAccessToken({
    userId: user.id,
    workspaceId,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // 2. 30-day rotated refresh token stored hashed in sessions table
  const sessionId = `s-${crypto.randomBytes(16).toString('hex')}`;
  const refreshToken = generateRefreshToken({ userId: user.id, sessionId });
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await db.execute({
      sql: `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at)
            VALUES (?, ?, ?, ?)`,
      args: [sessionId, user.id, refreshHash, expiresAt],
    });
  } catch (err) {
    console.error('[Auth] Error saving session to database:', err);
  }

  // Access token cookie
  res.cookie('myspace_access', accessToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('myspace_session', accessToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });

  // Refresh token cookie
  res.cookie('myspace_refresh', refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // CSRF token: readable double-submit cookie
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie('csrf', csrfToken, {
    httpOnly: false,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.cookie('myspace_csrf', csrfToken, {
    httpOnly: false,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return csrfToken;
}

function clearAuthCookies(res: Response): void {
  const opts = {
    secure: config.env === 'production',
    sameSite: 'lax' as const,
  };
  res.clearCookie('myspace_access', { ...opts, httpOnly: true });
  res.clearCookie('myspace_session', { ...opts, httpOnly: true });
  res.clearCookie('myspace_refresh', { ...opts, httpOnly: true });
  res.clearCookie('csrf', opts);
  res.clearCookie('myspace_csrf', opts);
}

// Signup
router.post('/signup', authLimiter, validateBody(signupSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const db = getDatabase();

    const existingRes = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });
    if (existingRes.rows.length > 0) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' },
      });
      return;
    }

    const userId = `u-${crypto.randomBytes(8).toString('hex')}`;
    const workspaceId = `w-${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, name, avatar_url, role, token_version)
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [userId, email, passwordHash, name, initials, 'Personal User'],
    });

    await db.execute({
      sql: `INSERT INTO profiles (user_id, display_name, avatar_url, timezone, theme)
            VALUES (?, ?, ?, ?, ?)`,
      args: [userId, name, initials, 'UTC', 'dark'],
    });

    await db.execute({
      sql: `INSERT INTO workspaces (id, user_id, name, description)
            VALUES (?, ?, ?, ?)`,
      args: [workspaceId, userId, `${name}'s Workspace`, 'Personal AI Workspace'],
    });

    const userObj = {
      id: userId,
      email,
      name,
      role: 'Personal User',
      tokenVersion: 1,
    };

    const csrfToken = await setAuthCookies(res, userObj, workspaceId);

    // Response body contains NO token — cookie-only sessions (F-05)
    res.json({
      success: true,
      data: {
        csrfToken,
        user: {
          id: userId,
          email,
          name,
          avatar: initials,
          role: 'Personal User',
          workspaceId,
          workspaceName: `${name}'s Workspace`,
        },
      },
    });
  } catch (err: any) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create account.' },
    });
  }
});

// Login
router.post('/login', authLimiter, validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const db = getDatabase();

    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });
    const user = userRes.rows[0] as any;
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    const match = await bcrypt.compare(password, String(user.password_hash));
    if (!match) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    const wsRes = await db.execute({
      sql: 'SELECT id, name FROM workspaces WHERE user_id = ? LIMIT 1',
      args: [user.id],
    });
    const workspace = wsRes.rows[0] as any;
    const workspaceId = workspace ? String(workspace.id) : `w-${user.id}`;
    const workspaceName = workspace ? String(workspace.name) : `${user.name}'s Workspace`;
    const tokenVersion = Number(user.token_version || 1);

    const userObj = {
      id: String(user.id),
      email: String(user.email),
      name: String(user.name),
      role: String(user.role),
      tokenVersion,
    };

    const csrfToken = await setAuthCookies(res, userObj, workspaceId);

    // Response body contains NO token — cookie-only sessions (F-05)
    res.json({
      success: true,
      data: {
        csrfToken,
        user: {
          id: String(user.id),
          email: String(user.email),
          name: String(user.name),
          avatar: user.avatar_url ? String(user.avatar_url) : undefined,
          role: String(user.role),
          workspaceId,
          workspaceName,
        },
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to authenticate.' },
    });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.myspace_refresh;
  if (refreshToken) {
    try {
      const db = getDatabase();
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.execute({
        sql: 'DELETE FROM sessions WHERE refresh_token_hash = ?',
        args: [refreshHash],
      });
    } catch {}
  }
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Logout all devices
router.post('/logout-all', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    await db.execute({
      sql: 'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
      args: [req.user!.userId],
    });
    await db.execute({
      sql: 'DELETE FROM sessions WHERE user_id = ?',
      args: [req.user!.userId],
    });
  } catch (err) {
    console.error('[Auth] Logout-all error:', err);
  }
  clearAuthCookies(res);
  res.json({ success: true, message: 'All sessions invalidated.' });
});

// Me (Current Session User)
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const userRes = await db.execute({
    sql: `
      SELECT u.id, u.email, u.name, u.avatar_url, u.role, p.theme, p.timezone, w.id as workspace_id, w.name as workspace_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN workspaces w ON u.id = w.user_id
      WHERE u.id = ?
      LIMIT 1
    `,
    args: [req.user!.userId],
  });
  const user = userRes.rows[0] as any;

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User record not found.' },
    });
    return;
  }

  // Ensure CSRF cookie is fresh
  const csrfToken = req.cookies?.csrf || req.cookies?.myspace_csrf || crypto.randomBytes(24).toString('hex');
  res.cookie('csrf', csrfToken, {
    httpOnly: false,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.cookie('myspace_csrf', csrfToken, {
    httpOnly: false,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: {
      id: String(user.id),
      email: String(user.email),
      name: String(user.name),
      avatar: user.avatar_url ? String(user.avatar_url) : undefined,
      role: String(user.role),
      theme: user.theme ? String(user.theme) : 'dark',
      timezone: user.timezone ? String(user.timezone) : 'UTC',
      workspaceId: user.workspace_id ? String(user.workspace_id) : undefined,
      workspaceName: user.workspace_name ? String(user.workspace_name) : undefined,
      csrfToken,
    },
  });
});

// Update Profile
router.put('/profile', requireAuth, validateBody(profileSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, theme, timezone } = req.body;
  const db = getDatabase();

  if (name) {
    await db.execute({
      sql: 'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [name, req.user!.userId],
    });
    await db.execute({
      sql: 'UPDATE profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      args: [name, req.user!.userId],
    });
  }

  if (theme) {
    await db.execute({
      sql: 'UPDATE profiles SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      args: [theme, req.user!.userId],
    });
  }

  if (timezone) {
    await db.execute({
      sql: 'UPDATE profiles SET timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      args: [timezone, req.user!.userId],
    });
  }

  res.json({ success: true, message: 'Profile updated successfully.' });
});

export default router;
