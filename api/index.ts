import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server/app';

const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Ensure req.url has /api prefix for Express routing if stripped by Vercel
    if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('[Vercel Handler Crash]', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVERLESS_FUNCTION_ERROR',
          message: err?.message || 'Serverless invocation error occurred.',
        },
      });
    }
  }
}

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false,
  },
};
