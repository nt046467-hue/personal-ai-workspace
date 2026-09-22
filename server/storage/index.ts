import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { put, del } from '@vercel/blob';
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
   * Store uploaded buffer securely in Vercel Blob (or local disk fallback in dev/test).
   */
  public async saveFile(
    workspaceId: string,
    originalName: string,
    buffer: Buffer
  ): Promise<{ filename: string; storagePath: string; size: number }> {
    const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(originalName).toLowerCase();
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
    const randomHash = crypto.randomBytes(16).toString('hex');
    const filename = `${randomHash}${safeExt}`;
    const pathname = `workspaces/${safeWorkspaceId}/${filename}`;

    // If Vercel Blob token is configured, upload to Blob storage
    if (config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(pathname, buffer, {
        access: 'public',
        token: config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN,
      });

      return {
        filename,
        storagePath: blob.url,
        size: buffer.length,
      };
    }

    // Local disk fallback for local dev / tests without Blob token
    const workspaceDir = path.join(this.baseDir, 'workspaces', safeWorkspaceId);
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    const fullPath = path.join(workspaceDir, filename);
    await fs.promises.writeFile(fullPath, buffer);

    return {
      filename,
      storagePath: path.join('workspaces', safeWorkspaceId, filename),
      size: buffer.length,
    };
  }

  /**
   * Fetch file buffer from Vercel Blob URL or local disk fallback.
   */
  public async getFileBuffer(storagePath: string): Promise<Buffer> {
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      const res = await fetch(storagePath);
      if (!res.ok) {
        throw new Error(`Failed to fetch file from storage: ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Local disk fallback
    const fullPath = path.isAbsolute(storagePath)
      ? storagePath
      : path.join(this.baseDir, storagePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found in storage');
    }
    return fs.promises.readFile(fullPath);
  }

  /**
   * Delete file from Vercel Blob or local disk.
   */
  public async deleteFile(storagePath: string): Promise<void> {
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      await del(storagePath, {
        token: config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN,
      });
      return;
    }

    const fullPath = path.isAbsolute(storagePath)
      ? storagePath
      : path.join(this.baseDir, storagePath);

    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

export const storageService = new StorageService();
