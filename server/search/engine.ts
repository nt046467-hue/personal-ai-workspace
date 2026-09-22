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
 * Escape and sanitise user query string for FTS5 MATCH expression.
 * Strips operators, quotes each token, and drops tokens < 2 chars.
 */
export function sanitizeFtsQuery(query: string): string {
  const tokens = query
    .replace(/[()":*^~-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);

  if (tokens.length === 0) return '';
  return tokens.map(t => `"${t.replace(/"/g, '')}"`).join(' ');
}

export class SearchEngine {
  /**
   * Universal workspace search using SQLite FTS5 with BM25 ranking.
   */
  public async search(
    workspaceId: string,
    query: string,
    options: { category?: string; limit?: number } = {}
  ): Promise<SearchResultItem[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const db = getDatabase();
    const limit = options.limit || 20;
    const category = options.category || 'all';
    const ftsQuery = sanitizeFtsQuery(cleanQuery);

    const results: SearchResultItem[] = [];

    // 1. Knowledge Items & Documents
    if (category === 'all' || category === 'knowledge' || category === 'note' || category === 'document') {
      let ftsFound = false;
      if (ftsQuery) {
        try {
          const kiRes = await db.execute({
            sql: `
              SELECT
                ki.id,
                ki.title,
                ki.excerpt,
                ki.content,
                ki.type,
                ki.metadata,
                ki.updated_at,
                bm25(knowledge_fts) AS fts_score
              FROM knowledge_fts
              JOIN knowledge_items ki ON knowledge_fts.item_id = ki.id
              WHERE knowledge_fts.workspace_id = ?
                AND knowledge_fts MATCH ?
              ORDER BY fts_score
              LIMIT ?
            `,
            args: [workspaceId, ftsQuery, limit],
          });

          for (const row of kiRes.rows) {
            ftsFound = true;
            const item = row as any;
            results.push({
              id: String(item.id),
              type: item.type === 'document' ? 'document' : 'note',
              title: String(item.title),
              excerpt: String(item.excerpt || (item.content ? item.content.slice(0, 200) + '...' : '')),
              score: Math.abs(Number(item.fts_score || 0)) + 15,
              metadata: item.metadata ? JSON.parse(String(item.metadata)) : undefined,
              urlOrTargetId: String(item.id),
              updatedAt: String(item.updated_at || new Date().toISOString()),
            });
          }

          // Document chunks
          const chunkRes = await db.execute({
            sql: `
              SELECT
                c.document_id,
                d.original_name as title,
                c.content as excerpt,
                d.updated_at,
                bm25(chunks_fts) AS fts_score
              FROM chunks_fts
              JOIN document_chunks c ON chunks_fts.chunk_id = c.id
              JOIN documents d ON c.document_id = d.id
              WHERE chunks_fts.workspace_id = ?
                AND chunks_fts MATCH ?
              ORDER BY fts_score
              LIMIT ?
            `,
            args: [workspaceId, ftsQuery, limit],
          });

          for (const row of chunkRes.rows) {
            ftsFound = true;
            const item = row as any;
            results.push({
              id: String(item.document_id),
              type: 'document',
              title: String(item.title),
              excerpt: String(item.excerpt).slice(0, 250) + '...',
              score: Math.abs(Number(item.fts_score || 0)) + 12,
              urlOrTargetId: String(item.document_id),
              updatedAt: String(item.updated_at || new Date().toISOString()),
            });
          }
        } catch (e) {
          console.warn('[Search] FTS5 query failed for knowledge:', e);
        }
      }

      // Parameterized LIKE fallback if FTS found nothing or query had no tokens > 1 char
      if (!ftsFound) {
        const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
        const itemsRes = await db.execute({
          sql: `
            SELECT id, title, excerpt, content, type, metadata, updated_at
            FROM knowledge_items
            WHERE workspace_id = ? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
            LIMIT ?
          `,
          args: [workspaceId, likePattern, likePattern, limit],
        });

        for (const row of itemsRes.rows) {
          const item = row as any;
          results.push({
            id: String(item.id),
            type: item.type === 'document' ? 'document' : 'note',
            title: String(item.title),
            excerpt: String(item.excerpt || (item.content ? item.content.slice(0, 200) + '...' : '')),
            score: 5,
            metadata: item.metadata ? JSON.parse(String(item.metadata)) : undefined,
            urlOrTargetId: String(item.id),
            updatedAt: String(item.updated_at || new Date().toISOString()),
          });
        }
      }
    }

    // 2. Tasks via FTS5 or LIKE
    if (category === 'all' || category === 'task' || category === 'tasks') {
      let tasksFound = false;
      if (ftsQuery) {
        try {
          const taskRes = await db.execute({
            sql: `
              SELECT
                t.id,
                t.title,
                t.notes,
                t.status,
                t.priority,
                t.updated_at,
                bm25(tasks_fts) AS fts_score
              FROM tasks_fts
              JOIN tasks t ON tasks_fts.task_id = t.id
              WHERE tasks_fts.workspace_id = ?
                AND tasks_fts MATCH ?
              ORDER BY fts_score
              LIMIT ?
            `,
            args: [workspaceId, ftsQuery, limit],
          });

          for (const row of taskRes.rows) {
            tasksFound = true;
            const t = row as any;
            results.push({
              id: String(t.id),
              type: 'task',
              title: String(t.title),
              excerpt: String(t.notes || `Task [${t.priority}] - Status: ${t.status}`),
              score: Math.abs(Number(t.fts_score || 0)) + 10,
              urlOrTargetId: String(t.id),
              updatedAt: String(t.updated_at || new Date().toISOString()),
            });
          }
        } catch (e) {
          console.warn('[Search] FTS5 query failed for tasks:', e);
        }
      }

      if (!tasksFound) {
        const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
        const taskRes = await db.execute({
          sql: `
            SELECT id, title, notes, status, priority, updated_at
            FROM tasks
            WHERE workspace_id = ? AND (title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')
            LIMIT ?
          `,
          args: [workspaceId, likePattern, likePattern, limit],
        });

        for (const row of taskRes.rows) {
          const t = row as any;
          results.push({
            id: String(t.id),
            type: 'task',
            title: String(t.title),
            excerpt: String(t.notes || `Task [${t.priority}] - Status: ${t.status}`),
            score: 4,
            urlOrTargetId: String(t.id),
            updatedAt: String(t.updated_at || new Date().toISOString()),
          });
        }
      }
    }

    // 3. Projects
    if (category === 'all' || category === 'project' || category === 'projects') {
      const likePattern = `%${cleanQuery.replace(/[%_\\]/g, '\\$&')}%`;
      const projRes = await db.execute({
        sql: `
          SELECT id, name, description, color, category, progress, updated_at
          FROM projects
          WHERE workspace_id = ? AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
          LIMIT ?
        `,
        args: [workspaceId, likePattern, likePattern, limit],
      });

      for (const row of projRes.rows) {
        const p = row as any;
        results.push({
          id: String(p.id),
          type: 'project',
          title: String(p.name),
          excerpt: String(p.description || `Project - ${p.progress}% completed`),
          score: 8,
          urlOrTargetId: String(p.id),
          updatedAt: String(p.updated_at || new Date().toISOString()),
        });
      }
    }

    // Sort descending by score
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export const searchEngine = new SearchEngine();
