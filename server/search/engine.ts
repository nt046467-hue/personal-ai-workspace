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

export class SearchEngine {
  /**
   * Universal workspace hybrid search
   */
  public search(
    workspaceId: string,
    query: string,
    options: { category?: string; limit?: number } = {}
  ): SearchResultItem[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const db = getDatabase();
    const limit = options.limit || 25;
    const category = options.category || 'all';

    const results: SearchResultItem[] = [];
    const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length > 1);

    // Helper to score match
    const calculateScore = (title: string, content: string, updatedAt?: string): number => {
      const lowerTitle = (title || '').toLowerCase();
      const lowerContent = (content || '').toLowerCase();

      let score = 0;
      // 1. Exact title match
      if (lowerTitle === cleanQuery) score += 100;
      else if (lowerTitle.startsWith(cleanQuery)) score += 60;
      else if (lowerTitle.includes(cleanQuery)) score += 40;

      // 2. Keyword tokens in title
      for (const token of queryTokens) {
        if (lowerTitle.includes(token)) score += 15;
      }

      // 3. Keyword tokens in content
      for (const token of queryTokens) {
        const occurrences = (lowerContent.match(new RegExp(token, 'g')) || []).length;
        score += Math.min(occurrences * 3, 25);
      }

      // 4. Recency bonus
      if (updatedAt) {
        const ageHours = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) score += 10;
        else if (ageHours < 168) score += 5;
      }

      return score;
    };

    // 1. Knowledge Items & Documents
    if (category === 'all' || category === 'knowledge' || category === 'note' || category === 'document') {
      const items = db.prepare(`
        SELECT id, title, content, excerpt, type, metadata, updated_at
        FROM knowledge_items
        WHERE workspace_id = ?
      `).all(workspaceId) as any[];

      for (const item of items) {
        const score = calculateScore(item.title, (item.content || '') + ' ' + (item.excerpt || ''), item.updated_at);
        if (score > 0) {
          results.push({
            id: item.id,
            type: item.type === 'document' ? 'document' : 'note',
            title: item.title,
            excerpt: item.excerpt || (item.content ? item.content.slice(0, 160) + '...' : ''),
            score,
            metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
            urlOrTargetId: item.id,
            updatedAt: item.updated_at,
          });
        }
      }
    }

    // 2. Tasks
    if (category === 'all' || category === 'tasks') {
      const tasks = db.prepare(`
        SELECT t.id, t.title, t.notes, t.status, t.priority, t.due_date, t.updated_at, p.name as project_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.workspace_id = ?
      `).all(workspaceId) as any[];

      for (const t of tasks) {
        const score = calculateScore(t.title, (t.notes || '') + ' ' + (t.project_name || ''), t.updated_at);
        if (score > 0) {
          results.push({
            id: t.id,
            type: 'task',
            title: t.title,
            excerpt: t.notes || (t.project_name ? `Project: ${t.project_name}` : `Due: ${t.due_date}`),
            score,
            metadata: { priority: t.priority, status: t.status, project: t.project_name },
            urlOrTargetId: t.id,
            updatedAt: t.updated_at,
          });
        }
      }
    }

    // 3. Projects
    if (category === 'all' || category === 'projects') {
      const projects = db.prepare(`
        SELECT id, name, description, status, progress, deadline, updated_at
        FROM projects
        WHERE workspace_id = ?
      `).all(workspaceId) as any[];

      for (const p of projects) {
        const score = calculateScore(p.name, p.description || '', p.updated_at);
        if (score > 0) {
          results.push({
            id: p.id,
            type: 'project',
            title: p.name,
            excerpt: p.description || `Status: ${p.status} • Progress: ${p.progress}%`,
            score,
            metadata: { status: p.status, progress: p.progress, deadline: p.deadline },
            urlOrTargetId: p.id,
            updatedAt: p.updated_at,
          });
        }
      }
    }

    // 4. Bookmarks
    if (category === 'all' || category === 'bookmarks') {
      const bookmarks = db.prepare(`
        SELECT id, url, title, description, notes, updated_at
        FROM bookmarks
        WHERE workspace_id = ?
      `).all(workspaceId) as any[];

      for (const b of bookmarks) {
        const score = calculateScore(b.title || b.url, (b.description || '') + ' ' + (b.notes || ''), b.updated_at);
        if (score > 0) {
          results.push({
            id: b.id,
            type: 'bookmark',
            title: b.title || b.url,
            excerpt: b.description || b.notes || b.url,
            score,
            metadata: { url: b.url },
            urlOrTargetId: b.url,
            updatedAt: b.updated_at,
          });
        }
      }
    }

    // Sort descending by relevance score, then recent
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return results.slice(0, limit);
  }
}

export const searchEngine = new SearchEngine();
