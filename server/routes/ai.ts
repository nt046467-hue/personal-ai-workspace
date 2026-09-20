import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { ragPipeline } from '../ai/rag';
import { getAIProvider } from '../ai/provider';

const router = Router();
router.use(requireAuth);

const aiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'AI request limit reached. Please wait a moment.' });

// POST /api/ai/chat/stream (Real Server-Sent Events streaming AI chat)
router.post('/chat/stream', aiLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { message, conversationId } = req.body;
  if (!message || !message.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Message content is required.' },
    });
    return;
  }

  const workspaceId = req.user!.workspaceId;
  const userId = req.user!.userId;
  const db = getDatabase();

  // Find or create conversation
  let activeConvId = conversationId;
  if (!activeConvId) {
    const existing = db.prepare('SELECT id FROM conversations WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1')
      .get(workspaceId) as any;
    if (existing) {
      activeConvId = existing.id;
    } else {
      activeConvId = `conv-${crypto.randomBytes(6).toString('hex')}`;
      db.prepare('INSERT INTO conversations (id, workspace_id, user_id, title) VALUES (?, ?, ?, ?)')
        .run(activeConvId, workspaceId, userId, message.trim().slice(0, 35) + '...');
    }
  }

  // 1. Save user message to database
  const userMsgId = `m-${crypto.randomBytes(6).toString('hex')}`;
  db.prepare(`
    INSERT INTO messages (id, conversation_id, workspace_id, user_id, role, content)
    VALUES (?, ?, ?, ?, 'user', ?)
  `).run(userMsgId, activeConvId, workspaceId, userId, message.trim());

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Emit initial ack with user message ID and conversation ID
  res.write(`data: ${JSON.stringify({ type: 'start', conversationId: activeConvId, userMessageId: userMsgId })}\n\n`);

  try {
    const assistantMsgId = `m-${crypto.randomBytes(6).toString('hex')}`;

    // Execute streaming RAG pipeline
    const result = await ragPipeline.executeStream(workspaceId, message.trim(), (token) => {
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    });

    // 2. Persist assistant response in database
    db.prepare(`
      INSERT INTO messages (id, conversation_id, workspace_id, user_id, role, content, sources, actions)
      VALUES (?, ?, ?, ?, 'assistant', ?, ?, ?)
    `).run(
      assistantMsgId,
      activeConvId,
      workspaceId,
      userId,
      result.answer,
      JSON.stringify(result.sources),
      JSON.stringify(result.actions)
    );

    // Update conversation timestamp
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(activeConvId);

    // Emit final completion event
    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsgId,
        content: result.answer,
        sources: result.sources,
        actions: result.actions,
      })}\n\n`
    );

    res.end();
  } catch (err: any) {
    console.error('[AI Chat] Stream error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message || 'AI generation failed' })}\n\n`);
    res.end();
  }
});

// GET /api/ai/brief (Data-driven daily workspace AI brief)
router.get('/brief', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;

  // Query real workspace items
  const pendingTasks = db.prepare(`
    SELECT title, priority, due_date
    FROM tasks
    WHERE workspace_id = ? AND completed = 0
    ORDER BY priority = 'high' DESC, due_date ASC
    LIMIT 5
  `).all(workspaceId) as any[];

  const activeProjects = db.prepare(`
    SELECT name, progress, deadline
    FROM projects
    WHERE workspace_id = ? AND status = 'active'
    LIMIT 4
  `).all(workspaceId) as any[];

  const recentDocs = db.prepare(`
    SELECT title, type, updated_at
    FROM knowledge_items
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
    LIMIT 3
  `).all(workspaceId) as any[];

  let briefText = `### Good Morning! Here is your Workspace AI Brief:\n\n`;

  if (pendingTasks.length > 0) {
    briefText += `**Priority Attention Required:**\n`;
    pendingTasks.forEach(t => {
      briefText += `• **[${t.priority.toUpperCase()}]** ${t.title} (${t.due_date})\n`;
    });
    briefText += `\n`;
  }

  if (activeProjects.length > 0) {
    briefText += `**Active Project Progress:**\n`;
    activeProjects.forEach(p => {
      briefText += `• **${p.name}**: ${p.progress}% completed (Target: ${p.deadline})\n`;
    });
    briefText += `\n`;
  }

  if (recentDocs.length > 0) {
    briefText += `**Recent Knowledge Additions:**\n`;
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

// POST /api/ai/action (Execute contextual AI actions like "Create task", "Summarize")
router.post('/action', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { action, text } = req.body;
  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;
  const userId = req.user!.userId;

  if (action === 'create_task') {
    const id = `t-${crypto.randomBytes(6).toString('hex')}`;
    const title = text ? text.slice(0, 100).trim() : 'New Action Item';

    db.prepare(`
      INSERT INTO tasks (id, workspace_id, user_id, title, notes, priority, due_date, due_category)
      VALUES (?, ?, ?, ?, 'Generated from AI action', 'medium', 'Today', 'today')
    `).run(id, workspaceId, userId, title);

    res.json({ success: true, message: `Task "${title}" created successfully.`, data: { id, title } });
    return;
  }

  if (action === 'summarize') {
    const provider = getAIProvider();
    const summary = await provider.summarize(text || '');
    res.json({ success: true, data: { summary } });
    return;
  }

  res.status(400).json({ success: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } });
});

export default router;
