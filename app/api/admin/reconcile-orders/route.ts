import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAdminSession } from '@/lib/adminAuth';
import { reconcilePendingOrders } from '@/lib/orderReconciliation';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    // 1. Dual Authorization: Support CRON_SECRET bearer token or active admin session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;
    let authSource = 'admin';

    if (cronSecret && authHeader) {
      const expected = `Bearer ${cronSecret}`;
      const authBuf = Buffer.from(authHeader);
      const expectedBuf = Buffer.from(expected);
      if (
        authBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(authBuf, expectedBuf)
      ) {
        isAuthorized = true;
        authSource = 'cron';
      }
    }

    if (!isAuthorized) {
      try {
        await verifyAdminSession();
        isAuthorized = true;
      } catch (authErr) {
        const msg = authErr instanceof Error ? authErr.message : 'Unauthorized';
        return NextResponse.json({ error: msg }, { status: 401 });
      }
    }

    let maxAgeMinutes = 15;
    let limit = 50;

    try {
      const body = await request.json();
      if (typeof body.maxAgeMinutes === 'number' && !isNaN(body.maxAgeMinutes)) {
        maxAgeMinutes = Math.min(10080, Math.max(5, Math.floor(body.maxAgeMinutes)));
      }
      if (typeof body.limit === 'number' && !isNaN(body.limit)) {
        limit = Math.min(100, Math.max(1, Math.floor(body.limit)));
      }
    } catch {
      // Body is optional
    }

    logger.info('Starting order reconciliation', { maxAgeMinutes, limit, authSource });

    const report = await reconcilePendingOrders({ maxAgeMinutes, limit });

    logger.info('Order reconciliation completed', { report });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    logger.error('Order reconciliation execution error', error);
    return NextResponse.json({ error: 'Failed to execute order reconciliation.' }, { status: 500 });
  }
}
