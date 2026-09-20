import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Helper to format KnowledgeItem for frontend
function formatKnowledgeItem(row: any, db: any): any {
  const metadata = row.metadata ? JSON.parse(row.metadata) : {};
  
  // Get tags for item
  const tagRows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN item_tags it ON t.id = it.tag_id
    WHERE it.item_id = ?
  `).all(row.id) as any[];
  const tags = tagRows.map(r => r.name);

  // Timeago helper
  const updatedDate = new Date(row.updated_at);
  const diffHours = Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60));
  let timeStr = 'Just now';
  if (diffHours >= 24) {
    timeStr = `${Math.floor(diffHours / 24)} days ago`;
  } else if (diffHours > 0) {
    timeStr = `${diffHours} hours ago`;
  }

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    excerpt: row.excerpt || '',
    tags: tags.length > 0 ? tags : (metadata.tags || []),
    updatedAt: timeStr,
    readTime: metadata.readTime || `${Math.max(1, Math.ceil((row.content?.length || 500) / 750))} min read`,
    pinned: Boolean(row.pinned),
    content: row.content || '',
    fileSize: metadata.fileSize,
    pageCount: metadata.pageCount,
  };
}

// GET /api/knowledge
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
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

  const items = db.prepare(query).all(...params);
  const formatted = items.map(item => formatKnowledgeItem(item, db));

  res.json({ success: true, data: formatted });
});

// GET /api/knowledge/:id
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId) as any;

  if (!item) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Knowledge item not found.' },
    });
    return;
  }

  res.json({ success: true, data: formatKnowledgeItem(item, db) });
});

// POST /api/knowledge
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const { title, content, type = 'note', tags = [] } = req.body;
  if (!title) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Title is required.' },
    });
    return;
  }

  const db = getDatabase();
  const id = `k-${crypto.randomBytes(6).toString('hex')}`;
  const excerpt = content ? content.slice(0, 160).replace(/[#*`]/g, '') + '...' : 'New scratchpad note';

  db.prepare(`
    INSERT INTO knowledge_items (id, workspace_id, user_id, title, content, excerpt, type, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.workspaceId,
    req.user!.userId,
    title.trim(),
    content || '',
    excerpt,
    type,
    JSON.stringify({ tags })
  );

  // Add tags
  for (const tagName of tags) {
    let tag = db.prepare('SELECT id FROM tags WHERE workspace_id = ? AND name = ?').get(req.user!.workspaceId, tagName) as any;
    if (!tag) {
      const tagId = `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      db.prepare('INSERT INTO tags (id, workspace_id, user_id, name) VALUES (?, ?, ?, ?)').run(tagId, req.user!.workspaceId, req.user!.userId, tagName);
      tag = { id: tagId };
    }
    db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, item_type) VALUES (?, ?, ?)').run(id, tag.id, 'knowledge');
  }

  // Record activity
  db.prepare('INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(`act-${Date.now()}`, req.user!.workspaceId, req.user!.userId, 'Created note', title.trim(), 'note', id);

  const created = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: formatKnowledgeItem(created, db) });
});

// PUT /api/knowledge/:id (Autosave & update)
router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const { title, content, tags, pinned } = req.body;
  const db = getDatabase();

  const existing = db.prepare('SELECT id, metadata FROM knowledge_items WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId) as any;

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Knowledge item not found.' },
    });
    return;
  }

  const excerpt = content ? content.slice(0, 160).replace(/[#*`]/g, '').trim() + '...' : undefined;
  const meta = existing.metadata ? JSON.parse(existing.metadata) : {};
  if (tags) meta.tags = tags;

  db.prepare(`
    UPDATE knowledge_items
    SET title = COALESCE(?, title),
        content = COALESCE(?, content),
        excerpt = COALESCE(?, excerpt),
        pinned = COALESCE(?, pinned),
        metadata = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND workspace_id = ?
  `).run(
    title !== undefined ? title : null,
    content !== undefined ? content : null,
    excerpt !== undefined ? excerpt : null,
    pinned !== undefined ? (pinned ? 1 : 0) : null,
    JSON.stringify(meta),
    req.params.id,
    req.user!.workspaceId
  );

  const updated = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: formatKnowledgeItem(updated, db) });
});

// DELETE /api/knowledge/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM knowledge_items WHERE id = ? AND workspace_id = ?')
    .run(req.params.id, req.user!.workspaceId);

  if (result.changes === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Knowledge item not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Knowledge item deleted.' });
});

export default router;
