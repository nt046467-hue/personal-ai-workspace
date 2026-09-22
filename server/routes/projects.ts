import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth);

async function formatProject(row: any, db: any): Promise<any> {
  const taskCountsRes = await db.execute({
    sql: `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open
      FROM tasks
      WHERE project_id = ?
    `,
    args: [row.id],
  });
  const taskCounts = taskCountsRes.rows[0] as any;

  const total = Number(taskCounts?.total || 0);
  const open = Number(taskCounts?.open || 0);
  const computedProgress = total > 0 ? Math.round(((total - open) / total) * 100) : Number(row.progress || 0);

  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    progress: computedProgress,
    openTasksCount: open,
    totalTasksCount: total,
    updatedAt: new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    status: row.status,
    deadline: row.deadline ? String(row.deadline) : 'No deadline',
    color: row.color ? String(row.color) : '#38bdf8',
    category: row.category ? String(row.category) : 'Engineering',
  };
}

// GET /api/projects
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const rowsRes = await db.execute({
    sql: 'SELECT * FROM projects WHERE workspace_id = ? ORDER BY updated_at DESC',
    args: [req.user!.workspaceId],
  });

  const formatted = await Promise.all(rowsRes.rows.map(r => formatProject(r, db)));
  res.json({ success: true, data: formatted });
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const rowRes = await db.execute({
    sql: 'SELECT * FROM projects WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (rowRes.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found.' },
    });
    return;
  }

  const formatted = await formatProject(rowRes.rows[0], db);
  res.json({ success: true, data: formatted });
});

// POST /api/projects
router.post('/', validateBody(createProjectSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, description, color = '#38bdf8', category = 'Engineering', deadline } = req.body;

  const db = getDatabase();
  const id = `p-${crypto.randomBytes(6).toString('hex')}`;

  await db.execute({
    sql: `
      INSERT INTO projects (id, workspace_id, user_id, name, description, color, category, deadline, status, progress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)
    `,
    args: [id, req.user!.workspaceId, req.user!.userId, name.trim(), description || '', color, category, deadline || 'Upcoming'],
  });

  // Record activity
  await db.execute({
    sql: 'INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [`act-${Date.now()}`, req.user!.workspaceId, req.user!.userId, 'Created project', name.trim(), 'project', id],
  });

  const createdRes = await db.execute({
    sql: 'SELECT * FROM projects WHERE id = ?',
    args: [id],
  });
  const formatted = await formatProject(createdRes.rows[0], db);
  res.status(201).json({ success: true, data: formatted });
});

// PUT /api/projects/:id
router.put('/:id', validateBody(updateProjectSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, description, color, category, deadline, status, progress } = req.body;
  const db = getDatabase();

  const existingRes = await db.execute({
    sql: 'SELECT id FROM projects WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (existingRes.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found.' },
    });
    return;
  }

  await db.execute({
    sql: `
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
    `,
    args: [
      name || null,
      description !== undefined ? description : null,
      color || null,
      category || null,
      deadline || null,
      status || null,
      progress !== undefined ? progress : null,
      req.params.id,
      req.user!.workspaceId,
    ],
  });

  const updatedRes = await db.execute({
    sql: 'SELECT * FROM projects WHERE id = ?',
    args: [req.params.id],
  });
  const formatted = await formatProject(updatedRes.rows[0], db);
  res.json({ success: true, data: formatted });
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'DELETE FROM projects WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Project deleted.' });
});

export default router;
