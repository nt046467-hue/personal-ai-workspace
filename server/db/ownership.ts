import { getDatabase } from './index';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';

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
 * Checks ownership asynchronously without throwing. Returns false if not owned.
 */
export async function isOwnedByWorkspace(table: string, id: string, workspaceId: string): Promise<boolean> {
  if (!id || !workspaceId) return false;
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table specified for ownership check: ${table}`);
  }

  const db = getDatabase();
  const res = await db.execute({
    sql: `SELECT id FROM ${table} WHERE id = ? AND workspace_id = ? LIMIT 1`,
    args: [id, workspaceId],
  });
  return res.rows.length > 0;
}

/**
 * Throws an error (caught by Express error handler) when ownership check fails.
 */
export async function assertOwned(table: string, id: string, workspaceId: string, customError?: string): Promise<void> {
  const owned = await isOwnedByWorkspace(table, id, workspaceId);
  if (!owned) {
    const err: any = new Error(customError || `${table.slice(0, -1)} not found or access denied.`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
}

/**
 * Express middleware: reads req.params.id and asserts it belongs to the current workspace.
 */
export function requireOwned(table: string, paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = req.params[paramName];
    const workspaceId = req.user?.workspaceId;
    if (!id || !workspaceId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing ID or workspace.' } });
      return;
    }
    const owned = await isOwnedByWorkspace(table, id, workspaceId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found or access denied.' } });
      return;
    }
    next();
  };
}
