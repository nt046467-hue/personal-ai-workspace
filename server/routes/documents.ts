import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { storageService } from '../storage';
import { documentProcessor } from '../pipeline/documentProcessor';

const router = Router();
router.use(requireAuth);

const uploadLimiter = createRateLimiter({ 
  windowMs: 15 * 60 * 1000, 
  max: 30, 
  message: 'Upload rate limit reached. Please wait a few minutes.' 
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const ALLOWED_BINARY_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const ALLOWED_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
]);

/**
 * Validates file magic bytes to ensure disallowed files are never stored.
 */
async function validateFileType(buffer: Buffer, originalName: string): Promise<string> {
  const detected = await fileTypeFromBuffer(buffer);
  if (detected) {
    if (ALLOWED_BINARY_MIMES.has(detected.mime)) {
      return detected.mime;
    }
    throw new Error(`Unsupported binary file type (${detected.mime}). Allowed: PDF, DOCX, PNG, JPEG, WEBP.`);
  }

  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_TEXT_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type for extension: ${ext || 'none'}. Allowed: PDF, DOCX, TXT, MD, CSV, JSON.`);
  }

  // Check for null bytes to reject binary masquerading as text
  if (buffer.slice(0, 4096).includes(0)) {
    throw new Error('Disallowed binary content detected in text upload.');
  }

  if (ext === '.json') return 'application/json';
  if (ext === '.csv') return 'text/csv';
  if (ext === '.md' || ext === '.markdown') return 'text/markdown';
  return 'text/plain';
}

// POST /api/documents/upload
router.post('/upload', uploadLimiter, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'No file provided for upload.' },
      });
      return;
    }

    // Enforce strict magic-bytes allowlist before storing in Blob
    let validatedMime: string;
    try {
      validatedMime = await validateFileType(file.buffer, file.originalname);
    } catch (validationErr: any) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: validationErr.message },
      });
      return;
    }

    const workspaceId = req.user!.workspaceId;
    const userId = req.user!.userId;
    const docId = `doc-${crypto.randomBytes(6).toString('hex')}`;
    const knowledgeItemId = `k-${crypto.randomBytes(6).toString('hex')}`;

    // Store in Vercel Blob (or local disk fallback)
    const saved = await storageService.saveFile(workspaceId, file.originalname, file.buffer);

    const db = getDatabase();

    const fileSizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    // 1. Create Knowledge Item
    await db.execute({
      sql: `
        INSERT INTO knowledge_items (id, workspace_id, user_id, title, content, excerpt, type, metadata)
        VALUES (?, ?, ?, ?, ?, ?, 'document', ?)
      `,
      args: [
        knowledgeItemId,
        workspaceId,
        userId,
        file.originalname,
        'Document uploaded. Processing in background...',
        `Uploaded document ${file.originalname} (${fileSizeFormatted})`,
        JSON.stringify({ fileSize: fileSizeFormatted, pageCount: 1, tags: ['Document', 'Uploaded'] }),
      ],
    });

    // 2. Create Document Record
    await db.execute({
      sql: `
        INSERT INTO documents (id, workspace_id, user_id, knowledge_item_id, filename, original_name, storage_path, mime_type, size, processing_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      args: [
        docId,
        workspaceId,
        userId,
        knowledgeItemId,
        saved.filename,
        file.originalname,
        saved.storagePath,
        validatedMime,
        saved.size,
      ],
    });

    // 3. Record activity
    await db.execute({
      sql: 'INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [`act-${Date.now()}`, workspaceId, userId, 'Uploaded document', file.originalname, 'document', knowledgeItemId],
    });

    // 4. Trigger async background processing
    setImmediate(() => {
      documentProcessor.processDocument(docId).catch(err => {
        console.error(`[Upload] Processing failed for ${docId}:`, err);
      });
    });

    res.status(201).json({
      success: true,
      data: {
        id: knowledgeItemId,
        documentId: docId,
        title: file.originalname,
        fileSize: fileSizeFormatted,
        status: 'pending',
        message: 'File uploaded successfully and queued for indexing.',
      },
    });
  } catch (err: any) {
    console.error('[Upload] Error uploading document:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: err.message || 'File upload failed.' },
    });
  }
});

// GET /api/documents/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const docRes = await db.execute({
    sql: `
      SELECT d.*, k.title, k.metadata
      FROM documents d
      LEFT JOIN knowledge_items k ON d.knowledge_item_id = k.id
      WHERE (d.id = ? OR d.knowledge_item_id = ?) AND d.workspace_id = ?
    `,
    args: [req.params.id, req.params.id, req.user!.workspaceId],
  });
  const doc = docRes.rows[0] as any;

  if (!doc) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Document not found or unauthorized.' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      id: String(doc.id),
      knowledgeItemId: doc.knowledge_item_id ? String(doc.knowledge_item_id) : undefined,
      title: String(doc.original_name || doc.title),
      mimeType: String(doc.mime_type),
      size: Number(doc.size),
      pageCount: Number(doc.page_count || 1),
      status: String(doc.processing_status),
      summary: doc.summary ? String(doc.summary) : undefined,
      extractedText: doc.extracted_text ? String(doc.extracted_text) : undefined,
      updatedAt: String(doc.updated_at),
    },
  });
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const docRes = await db.execute({
    sql: `
      SELECT storage_path, original_name, mime_type
      FROM documents
      WHERE (id = ? OR knowledge_item_id = ?) AND workspace_id = ?
    `,
    args: [req.params.id, req.params.id, req.user!.workspaceId],
  });
  const doc = docRes.rows[0] as any;

  if (!doc) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Document not found.' },
    });
    return;
  }

  try {
    const buffer = await storageService.getFileBuffer(String(doc.storage_path));
    res.setHeader('Content-Type', String(doc.mime_type));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(String(doc.original_name))}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DOWNLOAD_FAILED', message: err.message },
    });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const docRes = await db.execute({
    sql: `
      SELECT id, storage_path, knowledge_item_id
      FROM documents
      WHERE (id = ? OR knowledge_item_id = ?) AND workspace_id = ?
    `,
    args: [req.params.id, req.params.id, req.user!.workspaceId],
  });
  const doc = docRes.rows[0] as any;

  if (!doc) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Document not found.' },
    });
    return;
  }

  // Delete storage file
  if (doc.storage_path) {
    await storageService.deleteFile(String(doc.storage_path)).catch(() => {});
  }

  // Delete DB records
  await db.execute({ sql: 'DELETE FROM documents WHERE id = ?', args: [doc.id] });
  if (doc.knowledge_item_id) {
    await db.execute({ sql: 'DELETE FROM knowledge_items WHERE id = ?', args: [doc.knowledge_item_id] });
  }

  res.json({ success: true, message: 'Document deleted successfully.' });
});

export default router;
