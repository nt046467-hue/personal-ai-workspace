import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { searchEngine } from '../search/engine';

const router = Router();
router.use(requireAuth);

// GET /api/search?q=...&category=...
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const query = (req.query.q as string) || '';
  const category = (req.query.category as string) || 'all';
  const limit = parseInt((req.query.limit as string) || '20', 10);

  if (!query.trim()) {
    res.json({ success: true, data: [] });
    return;
  }

  try {
    const results = await searchEngine.search(req.user!.workspaceId, query, { category, limit });
    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[Search] Error executing search:', err);
    res.status(200).json({ success: true, data: [] });
  }
});

export default router;
