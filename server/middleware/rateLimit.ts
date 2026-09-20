import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, RateLimitRecord>();

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req as any).user?.userId || req.ip || 'anonymous';
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      hits.set(key, record);
      next();
      return;
    }

    record.count++;
    if (record.count > options.max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message || 'Too many requests. Please slow down and try again shortly.',
          retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
        },
      });
      return;
    }

    next();
  };
}
