import { Router, Response } from 'express';
import crypto from 'crypto';
import dns from 'dns';
import net from 'net';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { assertOwned } from '../db/ownership';
import { createBookmarkSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth);

/**
 * Checks if an IP address is in a private, loopback, link-local, or cloud metadata range.
 */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local, cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // Broadcast
    if (parts[0] === 255) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 loopback
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    if (normalized.startsWith('::ffff:')) {
      const v4Part = normalized.slice(7);
      if (net.isIPv4(v4Part)) {
        return isPrivateIp(v4Part);
      }
    }
    // Unique local address (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // Link-local (fe80::/10)
    if (normalized.startsWith('fe80') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    return false;
  }

  return true;
}

/**
 * Resolves DNS and validates that all IP addresses are public and safe.
 */
async function validateUrlForSsrf(urlString: string): Promise<URL | null> {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return null;
    }

    // Direct IP address check
    if (net.isIP(hostname)) {
      if (isPrivateIp(hostname)) return null;
      return parsed;
    }

    // Resolve DNS lookup
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return null;
    }

    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Safely fetches URL metadata with max 3 hops and body size capped to 512KB.
 */
async function fetchBookmarkMetadataSafely(initialUrl: string): Promise<{ title?: string; description?: string; favicon?: string }> {
  let currentUrl = initialUrl;
  let hops = 0;
  const maxHops = 3;

  while (hops <= maxHops) {
    const validated = await validateUrlForSsrf(currentUrl);
    if (!validated) {
      return {};
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const resp = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'MySpace-AI-Workspace-Bot/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);

      // Handle Redirects
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const location = resp.headers.get('location');
        if (!location || hops === maxHops) {
          return {};
        }
        currentUrl = new URL(location, currentUrl).toString();
        hops++;
        continue;
      }

      if (!resp.ok) {
        return {};
      }

      // Stream body up to 512KB (524288 bytes)
      const reader = resp.body?.getReader();
      if (!reader) return {};

      const decoder = new TextDecoder('utf-8');
      let html = '';
      let bytesRead = 0;
      const maxBytes = 512 * 1024;

      while (bytesRead < maxBytes) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break; // Stop early once head is read
      }

      reader.cancel().catch(() => {});

      let title: string | undefined;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      let description: string | undefined;
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }

      const parsedFinal = new URL(currentUrl);
      const favicon = `https://www.google.com/s2/favicons?domain=${parsedFinal.hostname}&sz=64`;

      return { title, description, favicon };
    } catch {
      clearTimeout(timeout);
      return {};
    }
  }

  return {};
}

// GET /api/bookmarks
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const rowsRes = await db.execute({
    sql: 'SELECT * FROM bookmarks WHERE workspace_id = ? ORDER BY created_at DESC',
    args: [req.user!.workspaceId],
  });
  res.json({ success: true, data: rowsRes.rows });
});

// POST /api/bookmarks
router.post('/', validateBody(createBookmarkSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { url, title: customTitle, description: customDesc, projectId } = req.body;

  let finalTitle = customTitle || url;
  let description = customDesc || '';
  let favicon = '';

  // Safe metadata fetching with strict SSRF defense
  const metadata = await fetchBookmarkMetadataSafely(url);
  if (metadata.title && !customTitle) {
    finalTitle = metadata.title;
  }
  if (metadata.description && !customDesc) {
    description = metadata.description;
  }
  if (metadata.favicon) {
    favicon = metadata.favicon;
  }

  // Tenant isolation: verify projectId FK belongs to this workspace
  if (projectId) {
    await assertOwned('projects', projectId, req.user!.workspaceId, 'Project not found in your workspace.');
  }

  const db = getDatabase();
  const id = `bm-${crypto.randomBytes(6).toString('hex')}`;

  await db.execute({
    sql: `
      INSERT INTO bookmarks (id, workspace_id, user_id, project_id, url, title, description, favicon, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      req.user!.workspaceId,
      req.user!.userId,
      projectId || null,
      url,
      finalTitle,
      description,
      favicon,
      req.body.notes || null,
    ],
  });

  const createdRes = await db.execute({
    sql: 'SELECT * FROM bookmarks WHERE id = ?',
    args: [id],
  });
  res.status(201).json({ success: true, data: createdRes.rows[0] });
});

// DELETE /api/bookmarks/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'DELETE FROM bookmarks WHERE id = ? AND workspace_id = ?',
    args: [req.params.id, req.user!.workspaceId],
  });

  if (result.rowsAffected === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Bookmark not found.' },
    });
    return;
  }

  res.json({ success: true, message: 'Bookmark deleted.' });
});

export default router;
