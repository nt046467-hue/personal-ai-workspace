import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initDatabase, getDatabase } from './db';
import { config } from './config';
import authRouter from './routes/auth';
import knowledgeRouter from './routes/knowledge';
import tasksRouter from './routes/tasks';
import projectsRouter from './routes/projects';
import bookmarksRouter from './routes/bookmarks';
import documentsRouter from './routes/documents';
import searchRouter from './routes/search';
import conversationsRouter from './routes/conversations';
import aiRouter from './routes/ai';
import activitiesRouter from './routes/activities';
import settingsRouter from './routes/settings';
import { csrfProtection } from './middleware/csrf';

export function createApp(): express.Application {
  const app = express();

  // Initialize DB & run migrations asynchronously
  getDatabase();
  initDatabase().catch(err => console.error('[App] Database init error:', err));

  // Security Hardening: Disable Express signature
  app.disable('x-powered-by');

  // Security Headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS: Allow-list only from configured APP_ORIGIN (never origin:true)
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, test suites)
        if (!origin) return callback(null, true);
        if (
          config.appOrigins.includes(origin) || 
          (origin && origin.endsWith('.vercel.app')) ||
          (origin && (origin.endsWith('.nabint.com.np') || origin === 'https://myspace.nabint.com.np'))
        ) {
          return callback(null, true);
        }
        // Deny unauthorized origin by omitting Access-Control-Allow-Origin
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  // Strict 1MB body limit; uploads handled separately with multer
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Double-submit CSRF Protection on mutating requests
  app.use(csrfProtection);

  // API Routes (Mounted with /api prefix and fallback without /api for Vercel Serverless Function rewrites)
  app.use(['/api/auth', '/auth'], authRouter);
  app.use(['/api/knowledge', '/knowledge'], knowledgeRouter);
  app.use(['/api/tasks', '/tasks'], tasksRouter);
  app.use(['/api/projects', '/projects'], projectsRouter);
  app.use(['/api/bookmarks', '/bookmarks'], bookmarksRouter);
  app.use(['/api/documents', '/documents'], documentsRouter);
  app.use(['/api/search', '/search'], searchRouter);
  app.use(['/api/conversations', '/conversations'], conversationsRouter);
  app.use(['/api/ai', '/ai'], aiRouter);
  app.use(['/api/activities', '/activities'], activitiesRouter);
  app.use(['/api/settings', '/settings'], settingsRouter);

  // Health check
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Global error handler — never leak internal details in production
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isDev = config.env !== 'production';
    console.error('[API Error]', err);

    if (err.status === 413 || err.statusCode === 413 || err.type === 'entity.too.large') {
      res.status(413).json({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload exceeds 1MB limit.' },
      });
      return;
    }

    if (err.statusCode && err.code) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }

    // Handle CORS errors
    if (err.message && err.message.startsWith('CORS:')) {
      res.status(403).json({
        success: false,
        error: { code: 'CORS_FORBIDDEN', message: 'Cross-origin request blocked.' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isDev ? (err.message || 'An unexpected server error occurred.') : 'An unexpected server error occurred.',
      },
    });
  });

  return app;
}
