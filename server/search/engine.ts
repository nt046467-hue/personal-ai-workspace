import { getDatabase } from '../db';

export interface SearchResultItem {
  id: string;
  type: 'note' | 'document' | 'task' | 'project' | 'bookmark' | 'conversation';
  title: string;
  excerpt: string;
  score: number;
  metadata?: Record<string, any>;
  urlOrTargetId?: string;
  updatedAt: string;
}

/**
 * Escape a user query string so it is safe to use as an FTS5 MATCH expression.
 * Strips characters that have special meaning in FTS5 syntax to prevent crashes and ReDoS.
 */
function sanitizeFtsQuery(query: string): string {
  // Remove special FTS5 operators: ()":*^~, reduce to plain word tokens joined by AND
  const tokens = query
    .replace(/[()":*^~-]/g, ' ')  // strip special chars
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);   // discard single chars (stops "on"→"onerror" false hits)

  if (tokens.length === 0) return '';

  // Quote each token to treat it as a literal phrase, not a phrase query
  return tokens.map(t => `"${t.replace(/"/g, '')}"`).join(' ');
}

export class SearchEngine {
  /**
   * Universal workspace search using SQLite FTS5 for BM25 ranking.
   * Falls back to parameterized LIKE for tables not in the FTS index.
   */
  public search(
    workspaceId: string,
    query: string,
    options: { category?: string; limit?: number } = {}
  ): SearchResultItem[] {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const db = getDatabase();
    const limit = options.limit || 25;
    const category = options.category || 'all';
    const ftsQuery = sanitizeFtsQuery(cleanQuery);

    const results: SearchResultItem[] = [];

    // 1. Knowledge Items & Documents via FTS5
    if (category === 'all' || category === 'knowledge' || category === 'note' || category === 'document') {
      let ftsFound = false;
      try {
        if (ftsQuery) {
          const rows = db.prepare(`
            SELECT
              ki.id,
              ki.title,
              ki.excerpt,
              ki.content,
              ki.type,
              ki.metadata,
              ki.updated_at,
              bm25(workspace_fts) AS fts_score
            FROM workspace_fts
            JOIN knowledge_items ki ON workspace_fts.item_id = ki.id
            WHERE workspace_fts.workspace_id = ?
              AND workspace_fts.item_type IN ('note', 'document', 'research', 'code')
              AND workspace_fts MATCH ?
            ORDER BY fts_score
            LIMIT ?
          `).all(workspaceId, ftsQuery, limit) as any[];

          for (const item of rows) {
            ftsFound = true;
            results.push({
              id: item.id,
              type: item.type === 'document' ? 'document' : 'note',
              title: item.title,
              excerpt: item.excerpt || (item.content ? item.content.slice(0, 200) + '...' : ''),
              score: Math.abs(item.fts_score) + 10,
              metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
              urlOrTargetId: item.id,
              updatedAt: item.updated_at,
            });
          }
        }
      } catch (e) {
        // FTS index may not be populated yet; silently degrade
        console.warn('[Search] FTS5 query failed for knowledge:', e);
      }

      if (!ftsFound) {
        const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
        const items = db.prepare(`
          SELECT id, title, excerpt, content, type, metadata, updated_at
          FROM knowledge_items
          WHERE workspace_id = ? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC
          LIMIT ?
        `).all(workspaceId, likePattern, likePattern, limit) as any[];

        for (const item of items) {
          results.push({
            id: item.id,
            type: item.type === 'document' ? 'document' : 'note',
            title: item.title,
            excerpt: item.excerpt || (item.content ? item.content.slice(0, 200) + '...' : ''),
            score: 8,
            metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
            urlOrTargetId: item.id,
            updatedAt: item.updated_at,
          });
        }
      }
    }

    // 2. Tasks — parameterized LIKE (no regex)
    if (category === 'all' || category === 'tasks') {
      const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
      const tasks = db.prepare(`
        SELECT t.id, t.title, t.notes, t.status, t.priority, t.due_date, t.updated_at, p.name as project_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id AND p.workspace_id = t.workspace_id
        WHERE t.workspace_id = ? AND (t.title LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\')
        ORDER BY t.updated_at DESC
        LIMIT ?
      `).all(workspaceId, likePattern, likePattern, limit) as any[];

      for (const t of tasks) {
        results.push({
          id: t.id,
          type: 'task',
          title: t.title,
          excerpt: t.notes || (t.project_name ? `Project: ${t.project_name}` : `Due: ${t.due_date}`),
          score: 5,
          metadata: { priority: t.priority, status: t.status, project: t.project_name },
          urlOrTargetId: t.id,
          updatedAt: t.updated_at,
        });
      }
    }

    // 3. Projects — parameterized LIKE
    if (category === 'all' || category === 'projects') {
      const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
      const projects = db.prepare(`
        SELECT id, name, description, status, progress, deadline, updated_at
        FROM projects
        WHERE workspace_id = ? AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(workspaceId, likePattern, likePattern, limit) as any[];

      for (const p of projects) {
        results.push({
          id: p.id,
          type: 'project',
          title: p.name,
          excerpt: p.description || `Status: ${p.status} · Progress: ${p.progress}%`,
          score: 5,
          metadata: { status: p.status, progress: p.progress, deadline: p.deadline },
          urlOrTargetId: p.id,
          updatedAt: p.updated_at,
        });
      }
    }

    // 4. Bookmarks — parameterized LIKE
    if (category === 'all' || category === 'bookmarks') {
      const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
      const bookmarks = db.prepare(`
        SELECT id, url, title, description, notes, updated_at
        FROM bookmarks
        WHERE workspace_id = ? AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(workspaceId, likePattern, likePattern, likePattern, limit) as any[];

      for (const b of bookmarks) {
        results.push({
          id: b.id,
          type: 'bookmark',
          title: b.title || b.url,
          excerpt: b.description || b.notes || b.url,
          score: 3,
          metadata: { url: b.url },
          urlOrTargetId: b.url,
          updatedAt: b.updated_at,
        });
      }
    }

    // Sort by score descending, deduplicate by id
    const seen = new Set<string>();
    return results
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const searchEngine = new SearchEngine();
