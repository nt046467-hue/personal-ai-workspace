import { Router, Response } from 'express';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { aiSettingsSchema } from '../validation/schemas';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../ai/keyEncryption';

const router = Router();
router.use(requireAuth);

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
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
  const db = getDatabase();

  try {
    const rowRes = await db.execute({
      sql: 'SELECT provider, model, base_url, api_key_enc FROM user_ai_settings WHERE user_id = ?',
      args: [userId],
    });

    if (rowRes.rows.length === 0 || !rowRes.rows[0].api_key_enc) {
      res.json({
        success: true,
        data: {
          hasCustomKey: false,
          provider: null,
          model: null,
          baseUrl: null,
          maskedKey: null,
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

  // 1. Live "test connection" call (1-token completion)
  let testUrl = `${targetBaseUrl}/chat/completions`;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  let body: any = {
    model,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 1,
  };

  if (provider === 'anthropic' && targetBaseUrl.includes('anthropic.com')) {
    testUrl = `${targetBaseUrl}/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    body = {
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    };
  }

  try {
    const testRes = await fetch(testUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!testRes.ok) {
      const errorBody = await testRes.text().catch(() => '');
      console.warn(`[Settings AI Test Failed] Status ${testRes.status}:`, errorBody);
      res.status(400).json({
        success: false,
        error: {
          code: 'PROVIDER_TEST_FAILED',
          message: "Couldn't connect with these settings — check your key and model name.",
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
        message: "Couldn't connect with these settings — check your key and model name.",
      },
    });
    return;
  }

  // 2. Encrypt and upsert into user_ai_settings
  try {
    const encryptedKey = encryptApiKey(apiKey);
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
      args: [userId, provider, model, targetBaseUrl, encryptedKey],
    });

    res.json({
      success: true,
      message: 'AI settings verified and saved successfully.',
      data: {
        hasCustomKey: true,
        provider,
        model,
        baseUrl: targetBaseUrl,
        maskedKey: maskApiKey(apiKey),
      },
    });
  } catch (encErr: any) {
    console.error('[Settings AI Encryption Error]', encErr);
    res.status(500).json({
      success: false,
      error: {
        code: 'ENCRYPTION_ERROR',
        message: encErr.message || 'Failed to encrypt API key. Ensure APP_ENCRYPTION_KEY is configured.',
      },
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
