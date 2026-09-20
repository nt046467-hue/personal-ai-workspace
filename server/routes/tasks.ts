import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatTask(row: any): any {
  return {
    id: row.id,
    title: row.title,
    project: row.project_name || 'General Workspace',
    projectId: row.project_id || 'p-1',
    dueDate: row.due_date || 'Today',
    dueCategory: row.due_category || (row.completed ? 'completed' : 'today'),
    priority: row.priority || 'medium',
    completed: Boolean(row.completed),
    notes: row.notes || '',
    estimatedMinutes: row.estimated_minutes || 30,
  };
}

// GET /api/tasks
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const workspaceId = req.user!.workspaceId;
  const { filter, projectId } = req.query;

  let query = `
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
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

  const rows = db.prepare(query).all(...params);
  res.json({ success: true, data: rows.map(formatTask) });
});

// POST /api/tasks
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const { title, project, projectId, dueDate, dueCategory = 'today', priority = 'medium', notes, estimatedMinutes = 30 } = req.body;
  if (!title) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Task title is required.' },
    });
    return;
  }

  const db = getDatabase();
  const id = `t-${crypto.randomBytes(6).toString('hex')}`;

  db.prepare(`
    INSERT INTO tasks (id, workspace_id, user_id, project_id, title, notes, priority, due_date, due_category, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.workspaceId,
    req.user!.userId,
    projectId || project || null,
    title.trim(),
    notes || null,
    priority,
    dueDate || 'Today',
    dueCategory,
    estimatedMinutes
  );

  // Record activity
  db.prepare('INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(`act-${Date.now()}`, req.user!.workspaceId, req.user!.userId, 'Created task', title.trim(), 'task', id);

  const created = db.prepare(`
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(id);

  res.status(201).json({ success: true, data: formatTask(created) });
});

// PATCH /api/tasks/:id/toggle
router.patch('/:id/toggle', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const task = db.prepare('SELECT id, completed, title FROM tasks WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId) as any;

  if (!task) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found.' },
    });
    return;
  }

  const nextState = task.completed ? 0 : 1;
  const completedAt = nextState ? new Date().toISOString() : null;

  db.prepare('UPDATE tasks SET completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(nextState, completedAt, req.params.id);

  if (nextState) {
    db.prepare('INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(`act-${Date.now()}`, req.user!.workspaceId, req.user!.userId, 'Completed task', task.title, 'task', req.params.id);
  }

  const updated = db.prepare(`
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json({ success: true, data: formatTask(updated) });
});

// PUT /api/tasks/:id
router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const { title, notes, priority, dueDate, dueCategory, estimatedMinutes, projectId } = req.body;
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM tasks WHERE id = ? AND workspace_id = ?')
    .get(req.params.id, req.user!.workspaceId);

  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found.' },
    });
    return;
  }

  db.prepare(`
    UPDATE tasks
    SET title = COALESCE(?, title),
        notes = COALESCE(?, notes),
        priority = COALESCE(?, priority),
        due_date = COALESCE(?, due_date),
        due_category = COALESCE(?, due_category),
        estimated_minutes = COALESCE(?, estimated_minutes),
        project_id = COALESCE(?, project_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND workspace_id = ?
  `).run(
    title || null,
    notes !== undefined ? notes : null,
    priority || null,
    dueDate || null,
    dueCategory || null,
    estimatedMinutes || null,
    projectId !== undefined ? projectId : null,
    req.params.id,
    req.user!.workspaceId
  );

  const updated = db.prepare(`
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json({ success: true, data: formatTask(updated) });
});

// DELETE /api/tasks/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND workspace_id = ?')
    .run(req.params.id, req.user!.workspaceId);

  if (result.changes === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Task deleted.' });
});

export default router;
