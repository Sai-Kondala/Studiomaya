import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';
import { reconcilePendingOrders } from '@/lib/orderReconciliation';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    // 1. Enforce admin authentication server-side
    await verifyAdminSession();

    let maxAgeMinutes = 15;
    let limit = 50;

    try {
      const body = await request.json();
      if (typeof body.maxAgeMinutes === 'number') maxAgeMinutes = body.maxAgeMinutes;
      if (typeof body.limit === 'number') limit = body.limit;
    } catch {
      // Body is optional
    }

    const report = await reconcilePendingOrders({ maxAgeMinutes, limit });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    logger.error('Order reconciliation execution error', error);
    return NextResponse.json({ error: 'Failed to execute order reconciliation.' }, { status: 500 });
  }
}
