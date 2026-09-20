import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { searchEngine } from '../search/engine';

const router = Router();
router.use(requireAuth);

// GET /api/search?q=...&category=...
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const query = (req.query.q as string) || '';
  const category = (req.query.category as string) || 'all';
  const limit = parseInt((req.query.limit as string) || '20', 10);

  if (!query.trim()) {
    res.json({ success: true, data: [] });
    return;
  }

  const results = searchEngine.search(req.user!.workspaceId, query, { category, limit });
  res.json({ success: true, data: results });
});

export default router;
