import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createConversationSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth);

// GET /api/conversations
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const convsRes = await db.execute({
    sql: `
      SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
      FROM conversations c
      WHERE c.workspace_id = ?
      ORDER BY c.updated_at DESC
    `,
    args: [req.user!.workspaceId],
  });

  res.json({ success: true, data: convsRes.rows });
});

// POST /api/conversations
router.post('/', validateBody(createConversationSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title } = req.body;
  const db = getDatabase();
  const id = `conv-${crypto.randomBytes(6).toString('hex')}`;

  await db.execute({
    sql: `
      INSERT INTO conversations (id, workspace_id, user_id, title)
      VALUES (?, ?, ?, ?)
    `,
    args: [id, req.user!.workspaceId, req.user!.userId, title ? title.trim() : 'New AI Consultation'],
  });

  const createdRes = await db.execute({
    sql: 'SELECT * FROM conversations WHERE id = ?',
    args: [id],
  });
  res.status(201).json({ success: true, data: createdRes.rows[0] });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const convRes = await db.execute({
    sql: 'SELECT id FROM conversations WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (convRes.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
    });
    return;
  }

  const messagesRes = await db.execute({
    sql: `
      SELECT * FROM messages
      WHERE conversation_id = ? AND workspace_id = ?
      ORDER BY created_at ASC
    `,
    args: [req.params.id, req.user!.workspaceId],
  });

  const formatted = messagesRes.rows.map((m: any) => ({
    id: String(m.id),
    sender: m.role,
    content: String(m.content),
    timestamp: new Date(String(m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sources: m.sources ? JSON.parse(String(m.sources)) : undefined,
    actions: m.actions ? JSON.parse(String(m.actions)) : undefined,
  }));

  res.json({ success: true, data: formatted });
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'DELETE FROM conversations WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Conversation deleted.' });
});

export default router;
