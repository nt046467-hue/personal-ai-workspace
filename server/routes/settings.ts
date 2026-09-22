import { Router, Response } from 'express';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { aiSettingsSchema } from '../validation/schemas';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../ai/keyEncryption';

import { config } from '../config';

const router = Router();
router.use(requireAuth);

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'openai':
    default:
      return 'https://api.openai.com/v1';
  }
}

/**
 * GET /api/settings/ai
 * Returns custom AI configuration status for the authenticated user.
 * Never returns the decrypted API key.
 */
router.get('/ai', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const workspaceId = req.user!.workspaceId;
  const db = getDatabase();

  try {
    const rowRes = await db.execute({
      sql: 'SELECT provider, model, base_url, api_key_enc FROM user_ai_settings WHERE user_id = ?',
      args: [userId],
    });

    const operatorConfigured = !!(config.aiApiKey && config.aiApiKey.trim().length > 0);

    let indexStats = { notes: 0, tasks: 0, bookmarks: 0, projects: 0 };
    if (workspaceId) {
      try {
        const statsRes = await db.execute({
          sql: `
            SELECT 
              (SELECT COUNT(*) FROM knowledge_items WHERE workspace_id = ?) as notes,
              (SELECT COUNT(*) FROM tasks WHERE workspace_id = ?) as tasks,
              (SELECT COUNT(*) FROM bookmarks WHERE workspace_id = ?) as bookmarks,
              (SELECT COUNT(*) FROM projects WHERE workspace_id = ?) as projects
          `,
          args: [workspaceId, workspaceId, workspaceId, workspaceId],
        });
        if (statsRes.rows.length > 0) {
          const s = statsRes.rows[0] as any;
          indexStats = {
            notes: Number(s.notes || 0),
            tasks: Number(s.tasks || 0),
            bookmarks: Number(s.bookmarks || 0),
            projects: Number(s.projects || 0),
          };
        }
      } catch (err) {
        // non-fatal
      }
    }

    if (rowRes.rows.length === 0 || !rowRes.rows[0].api_key_enc) {
      res.json({
        success: true,
        data: {
          hasCustomKey: false,
          provider: null,
          model: null,
          baseUrl: null,
          maskedKey: null,
          dailyCap: config.aiDailyCapDefault,
          operatorConfigured,
          indexStats,
        },
      });
      return;
    }

    const row = rowRes.rows[0] as any;
    let maskedKey = '••••';
    try {
      const decrypted = decryptApiKey(String(row.api_key_enc));
      maskedKey = maskApiKey(decrypted);
    } catch (err) {
      console.error('[Settings] Error decrypting user API key for masking:', err);
    }

    res.json({
      success: true,
      data: {
        hasCustomKey: true,
        provider: row.provider ? String(row.provider) : null,
        model: row.model ? String(row.model) : null,
        baseUrl: row.base_url ? String(row.base_url) : null,
        maskedKey,
        dailyCap: config.aiDailyCapDefault,
        operatorConfigured,
        indexStats,
      },
    });
  } catch (err: any) {
    console.error('[Settings] Failed to fetch AI settings:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve AI settings.' },
    });
  }
});

/**
 * PUT /api/settings/ai
 * Tests the provided API key with a live 1-token request before storing it encrypted.
 */
router.put('/ai', validateBody(aiSettingsSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { provider, model, baseUrl, apiKey } = req.body;
  const db = getDatabase();

  const targetBaseUrl = (baseUrl && String(baseUrl).trim().length > 0)
    ? String(baseUrl).trim().replace(/\/$/, '')
    : getDefaultBaseUrl(provider);

  const targetModel = (model && String(model).trim().length > 0)
    ? String(model).trim()
    : (provider === 'gemini' 
        ? 'gemini-1.5-flash' 
        : provider === 'groq' 
        ? 'llama-3.3-70b-versatile' 
        : provider === 'openrouter'
        ? 'anthropic/claude-3.5-sonnet'
        : 'gpt-4o-mini');

  // Resolve effective API key: use provided key, or fallback to previously stored key
  let effectiveApiKey = apiKey && String(apiKey).trim().length > 0 ? String(apiKey).trim() : '';

  if (!effectiveApiKey) {
    const existingRes = await db.execute({
      sql: 'SELECT api_key_enc FROM user_ai_settings WHERE user_id = ?',
      args: [userId],
    });
    if (existingRes.rows.length > 0 && existingRes.rows[0].api_key_enc) {
      try {
        effectiveApiKey = decryptApiKey(String(existingRes.rows[0].api_key_enc));
      } catch (err) {
        console.error('[Settings] Error decrypting existing key:', err);
      }
    }
  }

  if (!effectiveApiKey && provider !== 'ollama') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Please provide a valid API key for this provider.' },
    });
    return;
  }

  if (!effectiveApiKey && provider === 'ollama') {
    effectiveApiKey = 'ollama';
  }

  // 1. Live "test connection" call (minimal completion test)
  let testUrl = `${targetBaseUrl}/chat/completions`;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${effectiveApiKey}`,
  };
  let body: any = {
    model: targetModel,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 5,
  };

  if (provider === 'anthropic' && targetBaseUrl.includes('anthropic.com')) {
    testUrl = `${targetBaseUrl}/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': effectiveApiKey,
      'anthropic-version': '2023-06-01',
    };
    body = {
      model: targetModel,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }],
    };
  }

  let latencyMs = 0;
  try {
    const startTime = Date.now();
    const testRes = await fetch(testUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    latencyMs = Math.round(Date.now() - startTime);

    if (!testRes.ok) {
      const errorBody = await testRes.text().catch(() => '');
      let parsedMsg = '';
      try {
        const parsed = JSON.parse(errorBody);
        parsedMsg = parsed.error?.message || parsed.message || '';
      } catch {
        parsedMsg = errorBody.slice(0, 140);
      }
      console.warn(`[Settings AI Test Failed] Status ${testRes.status}:`, errorBody);
      res.status(400).json({
        success: false,
        error: {
          code: 'PROVIDER_TEST_FAILED',
          message: parsedMsg 
            ? `Upstream error (${testRes.status}): ${parsedMsg}`
            : `Could not connect to ${provider} (HTTP ${testRes.status}). Please check your API key and model name.`,
        },
      });
      return;
    }
  } catch (testErr: any) {
    console.warn('[Settings AI Test Error]', testErr.message);
    res.status(400).json({
      success: false,
      error: {
        code: 'PROVIDER_TEST_FAILED',
        message: testErr.name === 'TimeoutError'
          ? 'Connection timed out. Please check your base URL and network connectivity.'
          : `Connection test failed: ${testErr.message || 'Check your key and base URL.'}`,
      },
    });
    return;
  }

  // 2. Encrypt and upsert into user_ai_settings
  try {
    const encryptedKey = encryptApiKey(effectiveApiKey);
    await db.execute({
      sql: `
        INSERT INTO user_ai_settings (user_id, provider, model, base_url, api_key_enc, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          provider = excluded.provider,
          model = excluded.model,
          base_url = excluded.base_url,
          api_key_enc = excluded.api_key_enc,
          updated_at = datetime('now')
      `,
      args: [userId, provider, targetModel, targetBaseUrl, encryptedKey],
    });

    res.json({
      success: true,
      message: 'AI settings verified and saved successfully.',
      data: {
        hasCustomKey: true,
        provider,
        model: targetModel,
        baseUrl: targetBaseUrl,
        maskedKey: maskApiKey(effectiveApiKey),
        latencyMs,
      },
    });
    return;
  } catch (err: any) {
    console.error('[Settings] Error saving user AI key:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to securely store AI key.' },
    });
  }
});

/**
 * DELETE /api/settings/ai
 * Removes the user's custom key and settings, reverting them to operator defaults / Search Mode.
 */
router.delete('/ai', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const db = getDatabase();

  try {
    await db.execute({
      sql: 'DELETE FROM user_ai_settings WHERE user_id = ?',
      args: [userId],
    });

    res.json({
      success: true,
      message: 'Custom AI key removed. Reverted to shared provider.',
    });
  } catch (err: any) {
    console.error('[Settings] Error removing custom AI settings:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete AI settings.' },
    });
  }
});

export default router;
