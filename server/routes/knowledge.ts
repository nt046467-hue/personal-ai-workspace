import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { assertOwned } from '../db/ownership';
import { createKnowledgeSchema, updateKnowledgeSchema } from '../validation/schemas';
import { formatRelativeTime } from '../utils/time';

const router = Router();
router.use(requireAuth);

// Helper to format KnowledgeItem for frontend
async function formatKnowledgeItem(row: any, db: any): Promise<any> {
  const metadata = row.metadata ? JSON.parse(String(row.metadata)) : {};
  
  // Get tags for item
  const tagRows = await db.execute({
    sql: `
      SELECT t.name FROM tags t
      JOIN item_tags it ON t.id = it.tag_id
      WHERE it.item_id = ?
    `,
    args: [row.id],
  });
  const tags = tagRows.rows.map((r: any) => String(r.name));

  const timeStr = formatRelativeTime(row.updated_at);

  return {
    id: String(row.id),
    title: String(row.title),
    type: row.type,
    excerpt: row.excerpt ? String(row.excerpt) : '',
    tags: tags.length > 0 ? tags : (metadata.tags || []),
    updatedAt: timeStr,
    lastViewedAt: row.last_viewed_at ? String(row.last_viewed_at) : undefined,
    readTime: metadata.readTime || `${Math.max(1, Math.ceil((row.content?.length || 500) / 750))} min read`,
    pinned: Boolean(row.pinned),
    content: row.content ? String(row.content) : '',
    fileSize: metadata.fileSize,
    pageCount: metadata.pageCount,
    projectId: row.project_id ? String(row.project_id) : null,
  };
}

// GET /api/knowledge
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;
  const { type, search } = req.query;

  let query = 'SELECT * FROM knowledge_items WHERE workspace_id = ?';
  const params: any[] = [workspaceId];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }

  if (search && typeof search === 'string') {
    query += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY pinned DESC, updated_at DESC';

  const itemsRes = await db.execute({ sql: query, args: params });
  const formatted = await Promise.all(itemsRes.rows.map(item => formatKnowledgeItem(item, db)));

  res.json({ success: true, data: formatted });
});

// PATCH /api/knowledge/:id/view (Record item view for Continue Reading)
router.patch('/:id/view', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  await db.execute({
    sql: 'UPDATE knowledge_items SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });
  res.json({ success: true, message: 'View recorded.' });
});

// GET /api/knowledge/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const itemRes = await db.execute({
    sql: 'SELECT * FROM knowledge_items WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (itemRes.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Knowledge item not found.' },
    });
    return;
  }

  // Update last_viewed_at
  db.execute({
    sql: 'UPDATE knowledge_items SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  }).catch(() => {});

  const formatted = await formatKnowledgeItem(itemRes.rows[0], db);
  res.json({ success: true, data: formatted });
});

// POST /api/knowledge
router.post('/', validateBody(createKnowledgeSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title, content, type = 'note', tags = [], projectId, folderId } = req.body;
  const wid = req.user!.workspaceId;

  // Tenant isolation: verify FK references belong to this workspace
  if (projectId) await assertOwned('projects', projectId, wid, 'Project not found in your workspace.');
  if (folderId) await assertOwned('folders', folderId, wid, 'Folder not found in your workspace.');

  const db = getDatabase();
  const id = `k-${crypto.randomBytes(6).toString('hex')}`;
  const excerpt = content ? content.slice(0, 160).replace(/[#*`]/g, '') + '...' : 'New scratchpad note';

  await db.execute({
    sql: `
      INSERT INTO knowledge_items (id, workspace_id, user_id, project_id, folder_id, title, content, excerpt, type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      wid,
      req.user!.userId,
      projectId || null,
      folderId || null,
      title.trim(),
      content || '',
      excerpt,
      type,
      JSON.stringify({ tags }),
    ],
  });

  // Add tags
  for (const tagName of tags) {
    const tagRes = await db.execute({
      sql: 'SELECT id FROM tags WHERE workspace_id = ? AND name = ?',
      args: [wid, tagName],
    });
    let tagId = tagRes.rows[0] ? String(tagRes.rows[0].id) : null;
    if (!tagId) {
      tagId = `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.execute({
        sql: 'INSERT INTO tags (id, workspace_id, user_id, name) VALUES (?, ?, ?, ?)',
        args: [tagId, wid, req.user!.userId, tagName],
      });
    }
    await db.execute({
      sql: 'INSERT OR IGNORE INTO item_tags (item_id, tag_id, item_type) VALUES (?, ?, ?)',
      args: [id, tagId, 'knowledge'],
    });
  }

  // Record activity
  await db.execute({
    sql: 'INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [`act-${Date.now()}`, req.user!.workspaceId, req.user!.userId, 'Created note', title.trim(), 'note', id],
  });

  const createdRes = await db.execute({
    sql: 'SELECT * FROM knowledge_items WHERE id = ?',
    args: [id],
  });
  const formatted = await formatKnowledgeItem(createdRes.rows[0], db);
  res.status(201).json({ success: true, data: formatted });
});

// PUT /api/knowledge/:id (Autosave & update)
router.put('/:id', validateBody(updateKnowledgeSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title, content, tags, pinned, projectId, folderId } = req.body;
  const wid = req.user!.workspaceId;
  const db = getDatabase();

  // Tenant isolation: verify FK references belong to this workspace
  if (projectId) await assertOwned('projects', projectId, wid, 'Project not found in your workspace.');
  if (folderId) await assertOwned('folders', folderId, wid, 'Folder not found in your workspace.');

  const existingRes = await db.execute({
    sql: 'SELECT id, metadata FROM knowledge_items WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, wid],
  });
  const existing = existingRes.rows[0] as any;

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Knowledge item not found.' },
    });
    return;
  }

  const excerpt = content ? content.slice(0, 160).replace(/[#*`]/g, '').trim() + '...' : undefined;
  const meta = existing.metadata ? JSON.parse(String(existing.metadata)) : {};
  if (tags) meta.tags = tags;

  await db.execute({
    sql: `
      UPDATE knowledge_items
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          excerpt = COALESCE(?, excerpt),
          pinned = COALESCE(?, pinned),
          project_id = CASE WHEN ? THEN ? ELSE project_id END,
          folder_id = CASE WHEN ? THEN ? ELSE folder_id END,
          metadata = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND workspace_id = ?
    `,
    args: [
      title !== undefined ? title : null,
      content !== undefined ? content : null,
      excerpt !== undefined ? excerpt : null,
      pinned !== undefined ? (pinned ? 1 : 0) : null,
      projectId !== undefined ? 1 : 0, projectId || null,
      folderId !== undefined ? 1 : 0, folderId || null,
      JSON.stringify(meta),
      req.params.id,
      wid,
    ],
  });

  const updatedRes = await db.execute({
    sql: 'SELECT * FROM knowledge_items WHERE id = ?',
    args: [req.params.id],
  });
  const formatted = await formatKnowledgeItem(updatedRes.rows[0], db);
  res.json({ success: true, data: formatted });
});

// DELETE /api/knowledge/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'DELETE FROM knowledge_items WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Knowledge item not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Knowledge item deleted.' });
});

export default router;
