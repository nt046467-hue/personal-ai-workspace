import { Router, Response } from 'express';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

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
