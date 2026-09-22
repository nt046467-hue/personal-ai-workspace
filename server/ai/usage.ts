import { getDatabase } from '../db';
import { config } from '../config';

/**
 * Increment and check daily usage for a user against the shared operator key.
 * Returns { allowed: true } if the user is within their allowed daily cap.
 * Returns { allowed: false } if the cap has been exceeded for today (UTC).
 *
 * NOTE: This cap is intentionally generous (default 500) for personal workspace use.
 * Set AI_DAILY_CAP_DEFAULT env var to a lower number for multi-tenant deployments.
 */
export async function incrementAndCheckDailyUsage(userId: string, cap?: number | null): Promise<{ allowed: boolean }> {
  const db = getDatabase();
  const effectiveCap = cap ?? config.aiDailyCapDefault;
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' (UTC)

  try {
    // 1. Check current count first to avoid incrementing if already at or over cap
    const checkRes = await db.execute({
      sql: 'SELECT request_count FROM ai_usage_daily WHERE user_id = ? AND day = ?',
      args: [userId, today],
    });

    const currentCount = checkRes.rows.length > 0 ? Number(checkRes.rows[0].request_count) : 0;
    if (currentCount >= effectiveCap) {
      return { allowed: false };
    }

    // 2. Increment atomically
    await db.execute({
      sql: `
        INSERT INTO ai_usage_daily (user_id, day, request_count)
        VALUES (?, ?, 1)
        ON CONFLICT(user_id, day) DO UPDATE SET
          request_count = request_count + 1
      `,
      args: [userId, today],
    });

    return { allowed: true };
  } catch (err) {
    console.error('[AI Usage] Error updating daily usage:', err);
    // On unexpected DB errors, do not block the user
    return { allowed: true };
  }
}

