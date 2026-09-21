import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth);

function formatProject(row: any, db: any): any {
  // Compute open and total tasks dynamically
  const taskCounts = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open
    FROM tasks
    WHERE project_id = ?
  `).get(row.id) as any;

  const total = taskCounts?.total || 0;
  const open = taskCounts?.open || 0;
  const computedProgress = total > 0 ? Math.round(((total - open) / total) * 100) : (row.progress || 0);

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    progress: computedProgress,
    openTasksCount: open,
    totalTasksCount: total,
    updatedAt: new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    status: row.status,
    deadline: row.deadline || 'No deadline',
    color: row.color || '#38bdf8',
    category: row.category || 'Engineering',
  };
}

// GET /api/projects
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC')
    .all(req.user!.workspaceId);

  res.json({ success: true, data: rows.map(r => formatProject(r, db)) });
});

// GET /api/projects/:id
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId);

  if (!row) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found.' },
    });
    return;
  }

  res.json({ success: true, data: formatProject(row, db) });
});

// POST /api/projects
router.post('/', validateBody(createProjectSchema), (req: AuthenticatedRequest, res: Response): void => {
  const { name, description, color = '#38bdf8', category = 'Engineering', deadline } = req.body;

  const db = getDatabase();
  const id = `p-${crypto.randomBytes(6).toString('hex')}`;

  db.prepare(`
    INSERT INTO projects (id, workspace_id, user_id, name, description, color, category, deadline, status, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)
  `).run(id, req.user!.workspaceId, req.user!.userId, name.trim(), description || '', color, category, deadline || 'Upcoming');

  // Record activity
  db.prepare('INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(`act-${Date.now()}`, req.user!.workspaceId, req.user!.userId, 'Created project', name.trim(), 'project', id);

  const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: formatProject(created, db) });
});

// PUT /api/projects/:id
router.put('/:id', validateBody(updateProjectSchema), (req: AuthenticatedRequest, res: Response): void => {
  const { name, description, color, category, deadline, status, progress } = req.body;
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM projects WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId);

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found.' },
    });
    return;
  }

  db.prepare(`
    UPDATE projects
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        category = COALESCE(?, category),
        deadline = COALESCE(?, deadline),
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND workspace_id = ?
  `).run(
    name || null,
    description !== undefined ? description : null,
    color || null,
    category || null,
    deadline || null,
    status || null,
    progress !== undefined ? progress : null,
    req.params.id,
    req.user!.workspaceId
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: formatProject(updated, db) });
});

// DELETE /api/projects/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND workspace_id = ?')
    .run(req.params.id, req.user!.workspaceId);

  if (result.changes === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Project deleted.' });
});

export default router;
