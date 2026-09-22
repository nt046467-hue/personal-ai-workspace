import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { 
  verifyToken, 
  verifyRefreshToken, 
  generateAccessToken, 
  generateRefreshToken, 
  AuthPayload 
} from '../auth/jwt';
import { getDatabase } from '../db';
import { config } from '../config';

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
  cookies: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body: any;
  method: string;
  path: string;
  file?: any;
  on: (event: string, listener: (...args: any[]) => void) => any;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const db = getDatabase();

  // 1. Try to extract access token from cookies (or Bearer header for testing/backward compat)
  let accessToken: string | undefined = req.cookies?.myspace_access || req.cookies?.myspace_session;
  if (!accessToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }

  // 2. If access token is present, try to verify it
  if (accessToken) {
    const payload = verifyToken(accessToken);
    if (payload) {
      try {
        const userRes = await db.execute({
          sql: 'SELECT id, email, name, role, token_version FROM users WHERE id = ?',
          args: [payload.userId],
        });
        const user = userRes.rows[0] as any;
        if (!user) {
          res.status(401).json({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'Authenticated user no longer exists.' },
          });
          return;
        }

        if (payload.tokenVersion && user.token_version && payload.tokenVersion !== user.token_version) {
          res.status(401).json({
            success: false,
            error: { code: 'SESSION_REVOKED', message: 'Session has been invalidated. Please log in again.' },
          });
          return;
        }

        req.user = {
          userId: String(user.id),
          workspaceId: payload.workspaceId,
          email: String(user.email),
          name: String(user.name),
          role: String(user.role),
          tokenVersion: Number(user.token_version || 1),
        };
        return next();
      } catch (err) {
        console.error('[Auth Middleware] Database error checking user:', err);
      }
    }
  }

  // 3. Access token was missing or expired: try refresh token rotation
  const refreshToken = req.cookies?.myspace_refresh;
  if (refreshToken) {
    const refreshPayload = verifyRefreshToken(refreshToken);
    if (refreshPayload) {
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      try {
        const sessionRes = await db.execute({
          sql: `SELECT id, user_id, expires_at 
                FROM sessions 
                WHERE id = ? AND refresh_token_hash = ? AND datetime(expires_at) > datetime('now')`,
          args: [refreshPayload.sessionId, refreshHash],
        });
        const session = sessionRes.rows[0] as any;

        if (session) {
          const userRes = await db.execute({
            sql: 'SELECT id, email, name, role, token_version FROM users WHERE id = ?',
            args: [session.user_id],
          });
          const user = userRes.rows[0] as any;

          const wsRes = await db.execute({
            sql: 'SELECT id FROM workspaces WHERE user_id = ? LIMIT 1',
            args: [session.user_id],
          });
          const workspace = wsRes.rows[0] as any;

          if (user && workspace) {
            // Rotate refresh token
            const newRefreshToken = generateRefreshToken({ userId: String(user.id), sessionId: String(session.id) });
            const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
            const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            await db.execute({
              sql: `UPDATE sessions 
                    SET refresh_token_hash = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?`,
              args: [newRefreshHash, newExpiresAt, session.id],
            });

            // Generate new 15-minute access token
            const newAccessToken = generateAccessToken({
              userId: String(user.id),
              workspaceId: String(workspace.id),
              email: String(user.email),
              name: String(user.name),
              role: String(user.role),
              tokenVersion: Number(user.token_version || 1),
            });

            // Set refreshed cookies
            res.cookie('myspace_access', newAccessToken, {
              httpOnly: true,
              secure: config.env === 'production',
              sameSite: 'lax',
              maxAge: 15 * 60 * 1000,
            });
            res.cookie('myspace_session', newAccessToken, {
              httpOnly: true,
              secure: config.env === 'production',
              sameSite: 'lax',
              maxAge: 15 * 60 * 1000,
            });
            res.cookie('myspace_refresh', newRefreshToken, {
              httpOnly: true,
              secure: config.env === 'production',
              sameSite: 'lax',
              maxAge: 30 * 24 * 60 * 60 * 1000,
            });

            req.user = {
              userId: String(user.id),
              workspaceId: String(workspace.id),
              email: String(user.email),
              name: String(user.name),
              role: String(user.role),
              tokenVersion: Number(user.token_version || 1),
            };
            return next();
          }
        }
      } catch (err) {
        console.error('[Auth Middleware] Database error checking session:', err);
      }
    }
  }

  // 4. No valid session
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required to access workspace.',
    },
  });
}
