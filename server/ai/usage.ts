import { getDatabase } from '../db';
import { config } from '../config';

/**
 * Increment and check daily usage for a user against the shared operator key.
 * Returns true if the user is within their allowed daily cap, or false if the user
 * has exceeded their cap for today (UTC).
 */
export async function incrementAndCheckDailyUsage(userId: string, cap?: number | null): Promise<boolean> {
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
      return false;
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

    return true;
  } catch (err) {
    console.error('[AI Usage] Error updating daily usage:', err);
    // On unexpected DB errors, do not block the user
    return true;
  }
}
