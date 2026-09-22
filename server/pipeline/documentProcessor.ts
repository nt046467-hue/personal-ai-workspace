import { createRequire } from 'module';
import { getDatabase } from '../db';
import { storageService } from '../storage';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

export interface ProcessedDocumentResult {
  text: string;
  pageCount: number;
  summary: string;
  chunks: string[];
}

export class DocumentProcessor {
  /**
   * Extract raw text from file buffer based on MIME type or filename extension
   */
  public async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<{ text: string; pageCount: number }> {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (mimeType === 'application/pdf' || ext === 'pdf') {
      try {
        const data = await pdfParse(buffer);
        return {
          text: data.text || '',
          pageCount: data.numpages || 1,
        };
      } catch (err) {
        console.error('[Processor] PDF parse error:', err);
        return { text: buffer.toString('utf-8'), pageCount: 1 };
      }
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return {
          text: result.value || '',
          pageCount: Math.max(1, Math.ceil(result.value.length / 2500)),
        };
      } catch (err) {
        console.error('[Processor] DOCX parse error:', err);
        return { text: buffer.toString('utf-8'), pageCount: 1 };
      }
    }

    // Default: TXT, Markdown, CSV, JSON, code, or other text formats
    const text = buffer.toString('utf-8');
    const estimatedPages = Math.max(1, Math.ceil(text.length / 2500));
    return {
      text,
      pageCount: estimatedPages,
    };
  }

  /**
   * Chunk text into overlapping segments for RAG retrieval
   */
  public chunkText(text: string, chunkSize: number = 600, overlap: number = 80): string[] {
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!cleanText) return [];

    const words = cleanText.split(/\s+/);
    if (words.length <= chunkSize) {
      return [cleanText];
    }

    const chunks: string[] = [];
    let i = 0;
    while (i < words.length) {
      const slice = words.slice(i, i + chunkSize);
      chunks.push(slice.join(' '));
      i += (chunkSize - overlap);
    }

    return chunks;
  }

  /**
   * Generate an informative summary from extracted document text
   */
  public generateSummary(text: string, title: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20);
    if (lines.length === 0) {
      return `Indexed document ${title}.`;
    }

    // Pick top paragraphs / headings
    const snippet = lines.slice(0, 3).join(' ');
    if (snippet.length > 300) {
      return snippet.slice(0, 297) + '...';
    }
    return snippet;
  }

  /**
   * Asynchronously process a document record in the database
   */
  public async processDocument(documentId: string): Promise<void> {
    const db = getDatabase();
    const docRes = await db.execute({
      sql: 'SELECT * FROM documents WHERE id = ?',
      args: [documentId],
    });
    const doc = docRes.rows[0] as any;
    if (!doc) return;

    try {
      // Mark as processing
      await db.execute({
        sql: 'UPDATE documents SET processing_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: ['processing', documentId],
      });

      const buffer = await storageService.getFileBuffer(String(doc.storage_path));
      const { text, pageCount } = await this.extractText(buffer, String(doc.mime_type), String(doc.original_name));
      const summary = this.generateSummary(text, String(doc.original_name));
      const chunks = this.chunkText(text);

      // Save document chunks
      await db.execute({
        sql: 'DELETE FROM document_chunks WHERE document_id = ?',
        args: [documentId],
      });

      for (let index = 0; index < chunks.length; index++) {
        const chunkContent = chunks[index];
        const chunkId = `chk-${documentId}-${index}`;
        const wordCount = chunkContent.split(/\s+/).length;
        await db.execute({
          sql: `INSERT INTO document_chunks (id, document_id, workspace_id, user_id, chunk_index, content, token_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [chunkId, documentId, doc.workspace_id, doc.user_id, index, chunkContent, wordCount],
        });
      }

      // Update document record to ready
      await db.execute({
        sql: `UPDATE documents
              SET extracted_text = ?, page_count = ?, summary = ?, processing_status = 'ready', updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [text, pageCount, summary, documentId],
      });

      // If document has associated knowledge_item, update it
      if (doc.knowledge_item_id) {
        await db.execute({
          sql: `UPDATE knowledge_items
                SET content = ?, excerpt = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [text, summary, doc.knowledge_item_id],
        });
      }

      console.log(`[Processor] Document ${doc.original_name} processed successfully (${chunks.length} chunks).`);
    } catch (err: any) {
      console.error(`[Processor] Failed to process document ${documentId}:`, err);
      await db.execute({
        sql: `UPDATE documents
              SET processing_status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [err.message || 'Processing failed', documentId],
      });
    }
  }
}

export const documentProcessor = new DocumentProcessor();
