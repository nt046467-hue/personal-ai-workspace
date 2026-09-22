import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { generateAccessToken, generateRefreshToken } from '../auth/jwt';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { signupSchema, loginSchema, profileSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas';
import { config } from '../config';
import { sendEmail } from '../email/resend';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const forgotPasswordLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

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
        error: { code: 'USER_NOT_FOUND', message: 'No account found with this email address.' },
      });
      return;
    }

    const match = await bcrypt.compare(password, String(user.password_hash));
    if (!match) {
      res.status(401).json({
        success: false,
        error: { code: 'WRONG_PASSWORD', message: 'Incorrect password. Please try again.' },
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

// Forgot Password
router.post('/forgot-password', forgotPasswordLimiter, validateBody(forgotPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const db = getDatabase();

    const userRes = await db.execute({
      sql: 'SELECT id, email, name FROM users WHERE email = ? LIMIT 1',
      args: [email],
    });
    const user = userRes.rows[0] as any;

    if (user) {
      // Invalidate any older unused tokens for this user
      await db.execute({
        sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`,
        args: [user.id],
      });

      const tokenId = `prt-${crypto.randomBytes(12).toString('hex')}`;
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await db.execute({
        sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        args: [tokenId, user.id, tokenHash, expiresAt],
      });

      const origin = (req.headers.origin && config.appOrigins.includes(req.headers.origin))
        ? req.headers.origin
        : config.appOrigin;
      const resetLink = `${origin}/reset-password?token=${rawToken}`;

      try {
        await sendEmail({
          to: String(user.email),
          subject: 'Reset your MySpace AI password',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; line-height: 1.6;">
              <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px;">Reset your password</h2>
              <p style="margin-bottom: 16px;">Hello ${user.name || 'there'},</p>
              <p style="margin-bottom: 24px;">We received a request to reset your password for your MySpace AI account. Click the button below to choose a new password:</p>
              <div style="margin: 28px 0;">
                <a href="${resetLink}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #64748b; font-size: 13px; margin-bottom: 8px;">Or copy and paste this URL into your browser:</p>
              <p style="color: #6366f1; font-size: 13px; word-break: break-all; margin-bottom: 24px;">${resetLink}</p>
              <p style="color: #64748b; font-size: 13px; margin-bottom: 8px;">This link will expire in 30 minutes.</p>
              <p style="color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `,
          text: `Hello ${user.name || 'there'},\n\nWe received a request to reset your password for your MySpace AI account.\n\nUse this link to reset your password:\n${resetLink}\n\nThis link will expire in 30 minutes.\n\nIf you didn't request a password reset, you can safely ignore this email.`,
        });
      } catch (emailErr) {
        console.error('[Auth] Password reset email dispatch failed:', emailErr);
      }
    } else {
      // Timing side-channel mitigation (P-13): dummy computation of comparable duration
      await bcrypt.hash('dummy-password-for-timing-side-channel-defense', 10);
    }

    res.json({
      success: true,
      message: "If that email exists, we've sent a reset link.",
    });
  } catch (err: any) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to process password recovery request.' },
    });
  }
});

// Reset Password
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    const db = getDatabase();

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenRes = await db.execute({
      sql: `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`,
      args: [tokenHash],
    });

    const tokenRecord = tokenRes.rows[0] as any;
    const isUnused = tokenRecord && (tokenRecord.used_at === null || tokenRecord.used_at === undefined);
    const isNotExpired = tokenRecord && new Date(String(tokenRecord.expires_at)).getTime() > Date.now();

    if (!tokenRecord || !isUnused || !isNotExpired) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'The password reset link is invalid or has expired. Please request a new one.',
        },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const userId = String(tokenRecord.user_id);

    // 1. Update user password and bump token_version to invalidate existing access tokens
    await db.execute({
      sql: `UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [passwordHash, userId],
    });

    // 2. Mark this token as used
    await db.execute({
      sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`,
      args: [tokenRecord.id],
    });

    // 3. Invalidate/delete all active refresh sessions for this user
    await db.execute({
      sql: `DELETE FROM sessions WHERE user_id = ?`,
      args: [userId],
    });

    // 4. Clear any auth cookies on the client
    clearAuthCookies(res);

    res.json({
      success: true,
      message: 'Password updated successfully. You can now log in with your new password.',
    });
  } catch (err: any) {
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to reset password.' },
    });
  }
});


export default router;
