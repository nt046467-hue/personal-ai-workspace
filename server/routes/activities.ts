import { Router, Response } from 'express';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { formatRelativeTime } from '../utils/time';

const router = Router();
router.use(requireAuth);

// GET /api/activities
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const rowsRes = await db.execute({
    sql: `
      SELECT * FROM activities
      WHERE workspace_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `,
    args: [req.user!.workspaceId],
  });

  const formatted = rowsRes.rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    detail: String(r.detail),
    timestamp: formatRelativeTime(String(r.created_at)),
    type: r.type,
    targetId: r.target_id ? String(r.target_id) : undefined,
  }));

  res.json({ success: true, data: formatted });
});

export default router;
