import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { assertOwned } from '../db/ownership';
import { createBookmarkSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth);

// Helper for SSRF protection
function isSafeUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }

    // Check private IP ranges
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// GET /api/bookmarks
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM bookmarks WHERE workspace_id = ? ORDER BY created_at DESC')
    .all(req.user!.workspaceId);
  res.json({ success: true, data: rows });
});

// POST /api/bookmarks
router.post('/', validateBody(createBookmarkSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { url, title: customTitle, description: customDesc, projectId } = req.body;

  let finalTitle = customTitle || url;
  let description = customDesc || '';
  let favicon = '';

  // Safe metadata fetching with timeout & SSRF protection
  if (isSafeUrl(url)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MySpace-AI-Workspace-Bot/1.0' },
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const html = await resp.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && !customTitle) {
          finalTitle = titleMatch[1].trim();
        }

        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
        if (descMatch) {
          description = descMatch[1].trim();
        }

        const parsedUrl = new URL(url);
        favicon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;
      }
    } catch {
      // Fallback gracefully on fetch error
    }
  }

  // Tenant isolation: verify projectId FK belongs to this workspace
  if (projectId) assertOwned('projects', projectId, req.user!.workspaceId, 'Project not found in your workspace.');

  const db = getDatabase();
  const id = `bm-${crypto.randomBytes(6).toString('hex')}`;

  db.prepare(`
    INSERT INTO bookmarks (id, workspace_id, user_id, project_id, url, title, description, favicon, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.workspaceId, req.user!.userId, projectId || null, url, finalTitle, description, favicon, (req.body.notes) || null);

  const created = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: created });
});

// DELETE /api/bookmarks/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM bookmarks WHERE id = ? AND workspace_id = ?')
    .run(req.params.id, req.user!.workspaceId);

  if (result.changes === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Bookmark not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Bookmark deleted.' });
});

export default router;
