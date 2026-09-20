import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { generateToken } from '../auth/jwt';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// Signup
router.post('/signup', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, password, and name are required.' },
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDatabase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' },
      });
      return;
    }

    const userId = `u-${crypto.randomBytes(8).toString('hex')}`;
    const workspaceId = `w-${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

    // Create User, Profile, and Personal Workspace in a transaction
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, avatar_url, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, cleanEmail, passwordHash, name.trim(), initials, 'Personal User');

      db.prepare(`
        INSERT INTO profiles (user_id, display_name, avatar_url, timezone, theme)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, name.trim(), initials, 'UTC', 'dark');

      db.prepare(`
        INSERT INTO workspaces (id, user_id, name, description)
        VALUES (?, ?, ?, ?)
      `).run(workspaceId, userId, `${name.trim()}'s Workspace`, 'Personal AI Workspace');

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const token = generateToken({
      userId,
      workspaceId,
      email: cleanEmail,
      name: name.trim(),
      role: 'Personal User',
    });

    res.cookie('myspace_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          email: cleanEmail,
          name: name.trim(),
          avatar: initials,
          role: 'Personal User',
          workspaceId,
          workspaceName: `${name.trim()}'s Workspace`,
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
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDatabase();

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    const workspace = db.prepare('SELECT id, name FROM workspaces WHERE user_id = ? LIMIT 1').get(user.id) as any;
    const workspaceId = workspace?.id || `w-${user.id}`;
    const workspaceName = workspace?.name || `${user.name}'s Workspace`;

    const token = generateToken({
      userId: user.id,
      workspaceId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.cookie('myspace_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar_url,
          role: user.role,
          workspaceId,
          workspaceName,
        },
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Login failed.' },
    });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('myspace_session');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Me (Current Session User)
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const user = db.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.role, p.theme, p.timezone, w.id as workspace_id, w.name as workspace_name
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN workspaces w ON u.id = w.user_id
    WHERE u.id = ?
    LIMIT 1
  `).get(req.user!.userId) as any;

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User record not found.' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar_url,
      role: user.role,
      theme: user.theme || 'dark',
      timezone: user.timezone || 'UTC',
      workspaceId: user.workspace_id,
      workspaceName: user.workspace_name,
    },
  });
});

// Update Profile
router.put('/profile', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { name, theme, timezone } = req.body;
  const db = getDatabase();

  if (name) {
    db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, req.user!.userId);
    db.prepare('UPDATE profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(name, req.user!.userId);
  }

  if (theme) {
    db.prepare('UPDATE profiles SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(theme, req.user!.userId);
  }

  if (timezone) {
    db.prepare('UPDATE profiles SET timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(timezone, req.user!.userId);
  }

  res.json({ success: true, message: 'Profile updated successfully.' });
});

export default router;
