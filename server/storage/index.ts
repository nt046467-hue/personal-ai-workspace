import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { put, del } from '@vercel/blob';
import { config } from '../config';

export class StorageService {
  private baseDir: string;

  constructor() {
    // On Vercel, /var/task is read-only. Use /tmp for local fallback, but Blob storage
    // is used for all actual file uploads when BLOB_READ_WRITE_TOKEN is configured.
    if (process.env.VERCEL) {
      // Use /tmp (the only writable directory on Vercel) for any local fallback needs.
      // In practice, all file storage goes through Vercel Blob when deployed.
      this.baseDir = '/tmp/myspace-storage';
    } else {
      this.baseDir = config.storageDir;
    }

    // Only attempt to create the directory if NOT on Vercel's read-only filesystem
    if (!process.env.VERCEL) {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } else {
      // On Vercel, /tmp is always writable — create the fallback dir lazily only if needed
      try {
        if (!fs.existsSync(this.baseDir)) {
          fs.mkdirSync(this.baseDir, { recursive: true });
        }
      } catch {
        // Ignore — Blob storage is used for all uploads on Vercel
      }
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
    const blobToken = config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      const preferredAccess = (process.env.BLOB_ACCESS as 'public' | 'private') || 'public';
      let blob;
      try {
        blob = await put(pathname, buffer, {
          access: preferredAccess,
          token: blobToken,
        });
      } catch (err: any) {
        if (
          err?.message?.includes('Cannot use public access on a private store') ||
          err?.message?.includes('private access') ||
          err?.message?.includes('private store')
        ) {
          console.warn('[Storage] Retrying blob upload with access: private');
          blob = await put(pathname, buffer, {
            access: 'private',
            token: blobToken,
          });
        } else if (
          err?.message?.includes('Cannot use private access on a public store') ||
          err?.message?.includes('public store')
        ) {
          console.warn('[Storage] Retrying blob upload with access: public');
          blob = await put(pathname, buffer, {
            access: 'public',
            token: blobToken,
          });
        } else {
          throw err;
        }
      }

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
      const headers: Record<string, string> = {};
      const token = config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(storagePath, { headers });
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
