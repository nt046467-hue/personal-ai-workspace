import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
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

// Configure multer for secure in-memory buffer handling with 25MB max size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

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

    const workspaceId = req.user!.workspaceId;
    const userId = req.user!.userId;
    const docId = `doc-${crypto.randomBytes(6).toString('hex')}`;
    const knowledgeItemId = `k-${crypto.randomBytes(6).toString('hex')}`;

    // Store in workspace private storage
    const saved = await storageService.saveFile(workspaceId, file.originalname, file.buffer);

    const db = getDatabase();

    // 1. Create Knowledge Item
    const fileSizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    db.prepare(`
      INSERT INTO knowledge_items (id, workspace_id, user_id, title, content, excerpt, type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, 'document', ?)
    `).run(
      knowledgeItemId,
      workspaceId,
      userId,
      file.originalname,
      'Document uploaded. Processing in background...',
      `Uploaded document ${file.originalname} (${fileSizeFormatted})`,
      JSON.stringify({ fileSize: fileSizeFormatted, pageCount: 1, tags: ['Document', 'Uploaded'] })
    );

    // 2. Create Document Record
    db.prepare(`
      INSERT INTO documents (id, workspace_id, user_id, knowledge_item_id, filename, original_name, storage_path, mime_type, size, processing_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      docId,
      workspaceId,
      userId,
      knowledgeItemId,
      saved.filename,
      file.originalname,
      saved.storagePath,
      file.mimetype || 'application/octet-stream',
      saved.size
    );

    // 3. Record activity
    db.prepare('INSERT INTO activities (id, workspace_id, user_id, title, detail, type, target_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(`act-${Date.now()}`, workspaceId, userId, 'Uploaded document', file.originalname, 'document', knowledgeItemId);

    // 4. Trigger async background processing without blocking response
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
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDatabase();
  const doc = db.prepare(`
    SELECT d.*, k.title, k.metadata
    FROM documents d
    LEFT JOIN knowledge_items k ON d.knowledge_item_id = k.id
    WHERE (d.id = ? OR d.knowledge_item_id = ?) AND d.workspace_id = ?
  `).get(req.params.id, req.params.id, req.user!.workspaceId) as any;

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
      id: doc.id,
      knowledgeItemId: doc.knowledge_item_id,
      title: doc.original_name || doc.title,
      mimeType: doc.mime_type,
      size: doc.size,
      pageCount: doc.page_count,
      status: doc.processing_status,
      summary: doc.summary,
      extractedText: doc.extracted_text,
      updatedAt: doc.updated_at,
    },
  });
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDatabase();
  const doc = db.prepare(`
    SELECT storage_path, original_name, mime_type
    FROM documents
    WHERE (id = ? OR knowledge_item_id = ?) AND workspace_id = ?
  `).get(req.params.id, req.params.id, req.user!.workspaceId) as any;

  if (!doc) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Document not found.' },
    });
    return;
  }

  try {
    const buffer = await storageService.getFileBuffer(doc.storage_path);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
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
  const doc = db.prepare(`
    SELECT id, storage_path, knowledge_item_id
    FROM documents
    WHERE (id = ? OR knowledge_item_id = ?) AND workspace_id = ?
  `).get(req.params.id, req.params.id, req.user!.workspaceId) as any;

  if (!doc) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Document not found.' },
    });
    return;
  }

  // Delete storage file
  if (doc.storage_path) {
    await storageService.deleteFile(doc.storage_path).catch(() => {});
  }

  // Delete DB records
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  if (doc.knowledge_item_id) {
    db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(doc.knowledge_item_id);
  }

  res.json({ success: true, message: 'Document deleted successfully.' });
});

export default router;
