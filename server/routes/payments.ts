import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// ─── Public: POST /api/payment-claims ────────────────────────────────────────
// User submits proof of payment; requires auth so we know their user_id.
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { note, reference } = req.body as { note?: string; reference?: string };
  const db = getDatabase();

  try {
    // Check if user already has an approved founder tier
    const userRes = await db.execute({
      sql: 'SELECT tier FROM users WHERE id = ?',
      args: [userId],
    });
    const user = userRes.rows[0] as any;
    if (user?.tier === 'founder') {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_FOUNDER', message: 'Your account is already upgraded to Founder tier.' },
      });
      return;
    }

    // Check for existing pending claim
    const existingRes = await db.execute({
      sql: "SELECT id FROM payment_claims WHERE user_id = ? AND status = 'pending'",
      args: [userId],
    });
    if (existingRes.rows.length > 0) {
      res.json({
        success: true,
        message: 'Your payment claim is already pending review. We will upgrade your account within 24 hours.',
      });
      return;
    }

    const claimId = `pc-${crypto.randomBytes(8).toString('hex')}`;
    await db.execute({
      sql: 'INSERT INTO payment_claims (id, user_id, note, reference) VALUES (?, ?, ?, ?)',
      args: [claimId, userId, note || null, reference || null],
    });

    res.json({
      success: true,
      message: 'Payment claim submitted! We will upgrade your account to Founder tier within 24 hours.',
      data: { claimId },
    });
  } catch (err: any) {
    console.error('[PaymentClaims] Error creating claim:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit payment claim.' },
    });
  }
});

// ─── GET /api/payment-claims/my-status ───────────────────────────────────────
// Returns the current user's tier and any pending claim.
router.get('/my-status', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const db = getDatabase();

  try {
    const userRes = await db.execute({
      sql: 'SELECT tier FROM users WHERE id = ?',
      args: [userId],
    });
    const user = userRes.rows[0] as any;
    const tier = (user?.tier as string) || 'free';

    const claimRes = await db.execute({
      sql: "SELECT id, status, created_at FROM payment_claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [userId],
    });
    const claim = claimRes.rows[0] as any || null;

    res.json({
      success: true,
      data: {
        tier,
        pendingClaim: claim ? { id: String(claim.id), status: String(claim.status), createdAt: String(claim.created_at) } : null,
      },
    });
  } catch (err: any) {
    console.error('[PaymentClaims] Error fetching status:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tier status.' },
    });
  }
});

// ─── Admin middleware ─────────────────────────────────────────────────────────
function requireAdmin(req: any, res: Response, next: any): void {
  const adminPassword = config.adminPassword;
  if (!adminPassword) {
    res.status(503).json({ success: false, error: { code: 'ADMIN_DISABLED', message: 'Admin panel is not configured.' } });
    return;
  }
  const authHeader = req.headers['x-admin-password'] || req.headers.authorization;
  const provided = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (provided !== adminPassword) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin password.' } });
    return;
  }
  next();
}

// ─── Admin: GET /api/admin/payment-claims ────────────────────────────────────
router.get('/admin', requireAdmin, async (_req: any, res: Response): Promise<void> => {
  const db = getDatabase();
  try {
    const result = await db.execute(`
      SELECT pc.id, pc.user_id, pc.note, pc.reference, pc.created_at, pc.status,
             u.email, u.name, u.tier
      FROM payment_claims pc
      JOIN users u ON u.id = pc.user_id
      ORDER BY pc.status = 'pending' DESC, pc.created_at DESC
      LIMIT 100
    `);

    const claims = result.rows.map((r: any) => ({
      id: String(r.id),
      userId: String(r.user_id),
      email: String(r.email),
      name: String(r.name),
      currentTier: String(r.tier || 'free'),
      note: r.note ? String(r.note) : null,
      reference: r.reference ? String(r.reference) : null,
      createdAt: String(r.created_at),
      status: String(r.status),
    }));

    res.json({ success: true, data: { claims } });
  } catch (err: any) {
    console.error('[Admin] Error listing claims:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list claims.' } });
  }
});

// ─── Admin: POST /api/admin/payment-claims/:id/approve ───────────────────────
router.post('/admin/:id/approve', requireAdmin, async (req: any, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDatabase();

  try {
    const claimRes = await db.execute({
      sql: 'SELECT user_id FROM payment_claims WHERE id = ?',
      args: [id],
    });
    const claim = claimRes.rows[0] as any;
    if (!claim) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Claim not found.' } });
      return;
    }

    // Upgrade user to founder
    await db.execute({
      sql: "UPDATE users SET tier = 'founder', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [claim.user_id],
    });

    // Mark claim as approved
    await db.execute({
      sql: "UPDATE payment_claims SET status = 'approved' WHERE id = ?",
      args: [id],
    });

    res.json({ success: true, message: `User ${claim.user_id} upgraded to Founder tier.` });
  } catch (err: any) {
    console.error('[Admin] Error approving claim:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve claim.' } });
  }
});

// ─── Admin: POST /api/admin/payment-claims/:id/reject ────────────────────────
router.post('/admin/:id/reject', requireAdmin, async (req: any, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDatabase();

  try {
    const result = await db.execute({
      sql: "UPDATE payment_claims SET status = 'rejected' WHERE id = ?",
      args: [id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Claim not found.' } });
      return;
    }
    res.json({ success: true, message: 'Claim rejected.' });
  } catch (err: any) {
    console.error('[Admin] Error rejecting claim:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reject claim.' } });
  }
});

// ─── Admin: POST /api/admin/set-tier ─────────────────────────────────────────
// Direct tier override: { userId, tier: 'free'|'founder' }
router.post('/admin/set-tier', requireAdmin, async (req: any, res: Response): Promise<void> => {
  const { userId, tier } = req.body as { userId: string; tier: string };
  if (!userId || !['free', 'founder'].includes(tier)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'userId and tier (free|founder) are required.' } });
    return;
  }
  const db = getDatabase();
  try {
    await db.execute({
      sql: "UPDATE users SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [tier, userId],
    });
    res.json({ success: true, message: `User ${userId} tier set to ${tier}.` });
  } catch (err: any) {
    console.error('[Admin] Error setting tier:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to set tier.' } });
  }
});

export default router;
