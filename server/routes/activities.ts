import { Router, Response } from 'express';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Helper for relative timestamps
function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// GET /api/activities
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM activities
    WHERE workspace_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(req.user!.workspaceId) as any[];

  const formatted = rows.map(r => ({
    id: r.id,
    title: r.title,
    detail: r.detail,
    timestamp: formatRelativeTime(r.created_at),
    type: r.type,
    targetId: r.target_id,
  }));

  res.json({ success: true, data: formatted });
});

export default router;
