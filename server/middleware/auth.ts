import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthPayload } from '../auth/jwt';
import { getDatabase } from '../db';

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Extract token from Authorization header or cookie
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.myspace_session) {
    token = req.cookies.myspace_session;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access workspace.',
      },
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Session has expired or token is invalid.',
      },
    });
    return;
  }

  // Verify that user still exists in database
  const db = getDatabase();
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(payload.userId) as any;

  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'The authenticated user no longer exists.',
      },
    });
    return;
  }

  req.user = {
    userId: user.id,
    workspaceId: payload.workspaceId,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  next();
}
