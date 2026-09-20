import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getDatabase } from './db';
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

export function createApp(): express.Application {
  const app = express();

  // Initialize DB & Seed if necessary
  getDatabase();

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/activities', activitiesRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected server error occurred.',
      },
    });
  });

  return app;
}
