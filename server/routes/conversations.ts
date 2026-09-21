import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createConversationSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth);

// GET /api/conversations
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const convs = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.workspace_id = ?
    ORDER BY c.updated_at DESC
  `).all(req.user!.workspaceId);

  res.json({ success: true, data: convs });
});

// POST /api/conversations
router.post('/', validateBody(createConversationSchema), (req: AuthenticatedRequest, res: Response): void => {
  const { title } = req.body;
  const db = getDatabase();
  const id = `conv-${crypto.randomBytes(6).toString('hex')}`;

  db.prepare(`
    INSERT INTO conversations (id, workspace_id, user_id, title)
    VALUES (?, ?, ?, ?)
  `).run(id, req.user!.workspaceId, req.user!.userId, title ? title.trim() : 'New AI Consultation');

  const created = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: created });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId);

  if (!conv) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
    });
    return;
  }

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ? AND workspace_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id, req.user!.workspaceId) as any[];

  const formatted = messages.map(m => ({
    id: m.id,
    sender: m.role,
    content: m.content,
    timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sources: m.sources ? JSON.parse(m.sources) : undefined,
    actions: m.actions ? JSON.parse(m.actions) : undefined,
  }));

  res.json({ success: true, data: formatted });
});

// DELETE /api/conversations/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM conversations WHERE id = ? AND workspace_id = ?')
    .run(req.params.id, req.user!.workspaceId);

  if (result.changes === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Conversation deleted.' });
});

export default router;
