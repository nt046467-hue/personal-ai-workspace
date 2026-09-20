import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

export class StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = config.storageDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Get secure private directory for a workspace
   */
  public getWorkspaceDir(workspaceId: string): string {
    // Sanitize workspaceId to prevent directory traversal
    const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(this.baseDir, 'workspaces', safeWorkspaceId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Store uploaded buffer securely inside user's private workspace bucket
   */
  public async saveFile(workspaceId: string, originalName: string, buffer: Buffer): Promise<{ filename: string; storagePath: string; size: number }> {
    const workspaceDir = this.getWorkspaceDir(workspaceId);
    const ext = path.extname(originalName).toLowerCase();
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
    const fileHash = crypto.randomBytes(16).toString('hex');
    const filename = `${fileHash}${safeExt}`;
    const storagePath = path.join('workspaces', workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_'), filename);
    const fullPath = path.join(workspaceDir, filename);

    await fs.promises.writeFile(fullPath, buffer);
    return {
      filename,
      storagePath,
      size: buffer.length,
    };
  }

  /**
   * Read file content securely
   */
  public async getFileBuffer(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, storagePath);
    // Path traversal check
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Invalid path traversal attempt');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found in storage');
    }
    return fs.promises.readFile(fullPath);
  }

  /**
   * Delete file securely
   */
  public async deleteFile(storagePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, storagePath);
    if (fullPath.startsWith(this.baseDir) && fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

export const storageService = new StorageService();
