import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { assertOwned, isOwnedByWorkspace } from '../db/ownership';

const router = Router();
router.use(requireAuth);

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(255, 'Title is too long.'),
  project: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  dueDate: z.string().max(100).optional(),
  dueCategory: z.enum(['today', 'tomorrow', 'upcoming', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
});

const updateTaskSchema = taskSchema.partial();

function formatTask(row: any): any {
  return {
    id: String(row.id),
    title: String(row.title),
    project: row.project_name ? String(row.project_name) : 'General Workspace',
    projectId: row.project_id ? String(row.project_id) : null,
    dueDate: row.due_date ? String(row.due_date) : 'Today',
    dueCategory: row.due_category || (row.completed ? 'completed' : 'today'),
    priority: row.priority || 'medium',
    completed: Boolean(row.completed),
    notes: row.notes || '',
    estimatedMinutes: Number(row.estimated_minutes || 30),
  };
}

// GET /api/tasks
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;
  const { filter, projectId } = req.query;

  let query = `
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id AND p.workspace_id = t.workspace_id
    WHERE t.workspace_id = ?
  `;
  const params: any[] = [workspaceId];

  if (projectId) {
    query += ' AND t.project_id = ?';
    params.push(projectId);
  }

  if (filter === 'today') {
    query += " AND t.completed = 0 AND t.due_category = 'today'";
  } else if (filter === 'upcoming') {
    query += " AND t.completed = 0 AND (t.due_category = 'tomorrow' OR t.due_category = 'upcoming')";
  } else if (filter === 'completed') {
    query += ' AND t.completed = 1';
  }

  query += " ORDER BY t.completed ASC, (t.priority = 'high') DESC, t.created_at DESC";

  const rows = await db.execute({ sql: query, args: params });
  res.json({ success: true, data: rows.rows.map(formatTask) });
});

// POST /api/tasks
router.post('/', validateBody(taskSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title, project, projectId, dueDate, dueCategory = 'today', priority = 'medium', notes, estimatedMinutes = 30 } = req.body;
  const db = getDatabase();

  let targetProjectId: string | null = null;
  const candidateId = projectId || (project && project.startsWith('p-') ? project : null);

  if (candidateId && candidateId.trim()) {
    const trimmedId = candidateId.trim();
    const isOwned = await isOwnedByWorkspace('projects', trimmedId, req.user!.workspaceId);
    if (isOwned) {
      targetProjectId = trimmedId;
    } else if (trimmedId === 'p-1') {
      // Gracefully handle legacy client hardcoded 'p-1' fallback if project does not exist
      targetProjectId = null;
    } else {
      await assertOwned('projects', trimmedId, req.user!.workspaceId, 'Selected project does not exist in your workspace.');
    }
  } else if (project && typeof project === 'string' && project.trim() && project.trim().toLowerCase() !== 'general workspace') {
    const pRes = await db.execute({
      sql: 'SELECT id FROM projects WHERE name = ? AND workspace_id = ? LIMIT 1',
      args: [project.trim(), req.user!.workspaceId],
    });
    if (pRes.rows.length > 0) {
      targetProjectId = String(pRes.rows[0].id);
    }
  }

  const id = `t-${crypto.randomBytes(6).toString('hex')}`;

  await db.execute({
    sql: `
      INSERT INTO tasks (id, workspace_id, user_id, project_id, title, notes, priority, due_date, due_category, estimated_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      req.user!.workspaceId,
      req.user!.userId,
      targetProjectId,
      title.trim(),
      notes || null,
      priority,
      dueDate || 'Today',
      dueCategory,
      estimatedMinutes,
    ],
  });

  // Record activity
  await db.execute({
    sql: 'INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [`act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, req.user!.workspaceId, req.user!.userId, 'Created task', title.trim(), 'task', id],
  });

  const createdRes = await db.execute({
    sql: `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id AND p.workspace_id = t.workspace_id
      WHERE t.id = ? AND t.workspace_id = ?
    `,
    args: [id, req.user!.workspaceId],
  });

  res.status(201).json({ success: true, data: formatTask(createdRes.rows[0]) });
});

// PATCH /api/tasks/:id/toggle
router.patch('/:id/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const taskRes = await db.execute({
    sql: 'SELECT id, completed, title FROM tasks WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });
  const task = taskRes.rows[0] as any;

  if (!task) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found.' },
    });
    return;
  }

  const nextState = task.completed ? 0 : 1;
  const completedAt = nextState ? new Date().toISOString() : null;

  await db.execute({
    sql: 'UPDATE tasks SET completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
    args: [nextState, completedAt, req.params.id, req.user!.workspaceId],
  });

  if (nextState) {
    await db.execute({
      sql: 'INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [`act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, req.user!.workspaceId, req.user!.userId, 'Completed task', task.title, 'task', req.params.id],
    });
  }

  const updatedRes = await db.execute({
    sql: `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id AND p.workspace_id = t.workspace_id
      WHERE t.id = ? AND t.workspace_id = ?
    `,
    args: [req.params.id, req.user!.workspaceId],
  });

  res.json({ success: true, data: formatTask(updatedRes.rows[0]) });
});

// PUT /api/tasks/:id
router.put('/:id', validateBody(updateTaskSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title, notes, priority, dueDate, dueCategory, estimatedMinutes, projectId } = req.body;
  const db = getDatabase();

  const existingRes = await db.execute({
    sql: 'SELECT id FROM tasks WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (existingRes.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found.' },
    });
    return;
  }

  if (projectId && projectId.trim()) {
    const trimmedId = projectId.trim();
    const isOwned = await isOwnedByWorkspace('projects', trimmedId, req.user!.workspaceId);
    if (!isOwned && trimmedId === 'p-1') {
      // Ignore legacy 'p-1' if not owned by this workspace
    } else {
      await assertOwned('projects', trimmedId, req.user!.workspaceId, 'Selected project does not exist in your workspace.');
    }
  }

  await db.execute({
    sql: `
      UPDATE tasks
      SET title = COALESCE(?, title),
          notes = COALESCE(?, notes),
          priority = COALESCE(?, priority),
          due_date = COALESCE(?, due_date),
          due_category = COALESCE(?, due_category),
          estimated_minutes = COALESCE(?, estimated_minutes),
          project_id = CASE WHEN ? THEN ? ELSE project_id END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND workspace_id = ?
    `,
    args: [
      title || null,
      notes !== undefined ? notes : null,
      priority || null,
      dueDate || null,
      dueCategory || null,
      estimatedMinutes || null,
      projectId !== undefined ? 1 : 0,
      projectId || null,
      req.params.id,
      req.user!.workspaceId,
    ],
  });

  const updatedRes = await db.execute({
    sql: `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id AND p.workspace_id = t.workspace_id
      WHERE t.id = ? AND t.workspace_id = ?
    `,
    args: [req.params.id, req.user!.workspaceId],
  });

  res.json({ success: true, data: formatTask(updatedRes.rows[0]) });
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'DELETE FROM tasks WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Task deleted.' });
});

export default router;
