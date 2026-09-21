import { getDatabase } from './index';

const ALLOWED_TABLES = new Set([
  'projects',
  'folders',
  'conversations',
  'knowledge_items',
  'documents',
  'tasks',
  'bookmarks',
]);

/**
 * Asserts that a record exists in the given table and belongs to the specified workspace.
 * Prevents IDOR and cross-tenant leakage.
 */
export function isOwnedByWorkspace(table: string, id: string, workspaceId: string): boolean {
  if (!id || !workspaceId) return false;
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table specified for ownership check: ${table}`);
  }

  const db = getDatabase();
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND workspace_id = ? LIMIT 1`).get(id, workspaceId);
  return Boolean(row);
}

export function assertOwned(table: string, id: string, workspaceId: string, customError?: string): void {
  if (!isOwnedByWorkspace(table, id, workspaceId)) {
    const err: any = new Error(customError || `${table.slice(0, -1)} not found or access denied.`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
}
