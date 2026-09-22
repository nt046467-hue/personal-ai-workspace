import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { ragPipeline } from '../ai/rag';
import { getAIProvider } from '../ai/provider';
import { isOwnedByWorkspace } from '../db/ownership';

export const maxDuration = 60;

const router = Router();
router.use(requireAuth);

const aiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'AI request limit reached. Please wait a moment.' });

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message content is required.').max(4000, 'Message too long.'),
  conversationId: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
});

// POST /api/ai/chat/stream
router.post('/chat/stream', aiLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input.';
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errorMsg },
    });
    return;
  }

  const { message, conversationId } = parsed.data;
  const workspaceId = req.user!.workspaceId;
  const userId = req.user!.userId;
  const db = getDatabase();

  // IDOR check: if conversationId supplied, assert it belongs to this workspace
  let activeConvId = conversationId;
  if (activeConvId) {
    const owned = await isOwnedByWorkspace('conversations', activeConvId, workspaceId);
    if (!owned) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
      });
      return;
    }
  } else {
    // Create a new conversation for this message
    activeConvId = `conv-${crypto.randomBytes(6).toString('hex')}`;
    await db.execute({
      sql: 'INSERT INTO conversations (id, workspace_id, user_id, title) VALUES (?, ?, ?, ?)',
      args: [activeConvId, workspaceId, userId, message.trim().slice(0, 50)],
    });
  }

  // Save user message
  const userMsgId = `m-${crypto.randomBytes(6).toString('hex')}`;
  const assistantMsgId = `m-${crypto.randomBytes(6).toString('hex')}`;

  await db.execute({
    sql: `
      INSERT INTO messages (id, conversation_id, workspace_id, user_id, role, content)
      VALUES (?, ?, ?, ?, 'user', ?)
    `,
    args: [userMsgId, activeConvId, workspaceId, userId, message.trim()],
  });

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flushHeaders?.();

  // Heartbeat comment ping every 15s to prevent proxy/Vercel timeouts
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': ping\n\n');
    }
  }, 15000);

  // Client abort handling
  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
    clearInterval(heartbeat);
  });

  res.write(`data: ${JSON.stringify({
    type: 'start',
    conversationId: activeConvId,
    userMessageId: userMsgId,
    assistantMessageId: assistantMsgId,
  })}\n\n`);

  try {
    const result = await ragPipeline.executeStream(
      workspaceId,
      message.trim(),
      (token) => {
        if (!abortController.signal.aborted && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'token', messageId: assistantMsgId, token })}\n\n`);
        }
      },
      abortController.signal
    );

    if (!abortController.signal.aborted && !res.writableEnded) {
      await db.execute({
        sql: `
          INSERT INTO messages (id, conversation_id, workspace_id, user_id, role, content, sources, actions)
          VALUES (?, ?, ?, ?, 'assistant', ?, ?, ?)
        `,
        args: [
          assistantMsgId,
          activeConvId,
          workspaceId,
          userId,
          result.answer,
          JSON.stringify(result.sources),
          JSON.stringify(result.actions),
        ],
      });

      await db.execute({
        sql: 'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [activeConvId],
      });

      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsgId,
        content: result.answer,
        sources: result.sources,
        actions: result.actions,
      })}\n\n`);
    }
  } catch (err: any) {
    console.error('[AI Chat Stream Error]', err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', messageId: assistantMsgId, message: 'AI request failed. Please try again.' })}\n\n`);
    }
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});

// GET /api/ai/brief
router.get('/brief', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;

  const tasksRes = await db.execute({
    sql: `
      SELECT title, priority, due_date
      FROM tasks
      WHERE workspace_id = ? AND completed = 0
      ORDER BY priority = 'high' DESC, due_date ASC
      LIMIT 5
    `,
    args: [workspaceId],
  });
  const pendingTasks = tasksRes.rows as any[];

  const projectsRes = await db.execute({
    sql: `
      SELECT name, progress, deadline
      FROM projects
      WHERE workspace_id = ? AND status = 'active'
      LIMIT 4
    `,
    args: [workspaceId],
  });
  const activeProjects = projectsRes.rows as any[];

  const docsRes = await db.execute({
    sql: `
      SELECT title, type, updated_at
      FROM knowledge_items
      WHERE workspace_id = ?
      ORDER BY updated_at DESC
      LIMIT 3
    `,
    args: [workspaceId],
  });
  const recentDocs = docsRes.rows as any[];

  let briefText = `### Workspace Brief\n\n`;

  if (pendingTasks.length > 0) {
    briefText += `**Pending Tasks:**\n`;
    pendingTasks.forEach(t => {
      briefText += `• **[${String(t.priority).toUpperCase()}]** ${t.title}${t.due_date ? ` (${t.due_date})` : ''}\n`;
    });
    briefText += `\n`;
  } else {
    briefText += `No pending tasks found.\n\n`;
  }

  if (activeProjects.length > 0) {
    briefText += `**Active Projects:**\n`;
    activeProjects.forEach(p => {
      briefText += `• **${p.name}**: ${p.progress}% complete${p.deadline ? ` (Target: ${p.deadline})` : ''}\n`;
    });
    briefText += `\n`;
  }

  if (recentDocs.length > 0) {
    briefText += `**Recent Notes & Documents:**\n`;
    recentDocs.forEach(d => {
      briefText += `• ${d.title} (${d.type})\n`;
    });
  }

  res.json({
    success: true,
    data: {
      brief: briefText,
      taskCount: pendingTasks.length,
      projectCount: activeProjects.length,
      timestamp: new Date().toISOString(),
    },
  });
});

const aiActionLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Too many AI actions. Please wait a moment.' });

// POST /api/ai/action
router.post('/action', aiActionLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { action, text } = req.body;
  if (!action || typeof action !== 'string') {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Action is required.' } });
    return;
  }

  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;
  const userId = req.user!.userId;

  if (action === 'create_task') {
    const id = `t-${crypto.randomBytes(6).toString('hex')}`;
    const title = text ? String(text).slice(0, 200).trim() : 'New Action Item';

    await db.execute({
      sql: `
        INSERT INTO tasks (id, workspace_id, user_id, title, notes, priority, due_date, due_category)
        VALUES (?, ?, ?, ?, 'Generated from AI action', 'medium', 'Today', 'today')
      `,
      args: [id, workspaceId, userId, title],
    });

    res.json({ success: true, message: `Task created successfully.`, data: { id, title } });
    return;
  }

  if (action === 'summarize') {
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Text is required for summarize action.' } });
      return;
    }
    const provider = getAIProvider();
    const summary = await provider.summarize(text.slice(0, 2000));
    res.json({ success: true, data: { summary } });
    return;
  }

  res.status(400).json({ success: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action type.` } });
});

export default router;
