import { Request, Response, NextFunction } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/auth/login',
  '/api/auth/signup',
  '/auth/signup',
  '/api/auth/forgot-password',
  '/auth/forgot-password',
  '/api/auth/reset-password',
  '/auth/reset-password',
  '/api/health',
  '/health',
]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Exempt public registration/login endpoints
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const cookieToken = (req.cookies?.csrf || req.cookies?.myspace_csrf) as string | undefined;

  if (!headerToken) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_FORBIDDEN',
        message: 'Missing required X-CSRF-Token header.',
      },
    });
    return;
  }

  // If a cookie is set, verify that the double-submitted token matches
  if (cookieToken && headerToken !== cookieToken) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_FORBIDDEN',
        message: 'Invalid CSRF token.',
      },
    });
    return;
  }

  next();
}
