import { NextResponse } from 'next/server';
import { cleanupExpiredCarts } from '@/lib/cartService';
import { verifyAdminSession } from '@/lib/adminAuth';

export async function POST(request: Request) {
  try {
    // 1. Check if authorized via CRON_SECRET header (e.g. Vercel Cron or GitHub Action)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    }

    // 2. Alternatively, check if caller is an authenticated admin user
    if (!isAuthorized) {
      try {
        await verifyAdminSession();
        isAuthorized = true;
      } catch {
        // Not an authenticated admin
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Cart cleanup requires a valid scheduler CRON_SECRET or admin privileges.' },
        { status: 401 }
      );
    }

    const cleanedCount = await cleanupExpiredCarts();
    return NextResponse.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} expired carts older than 7 days.`,
    });
  } catch (error) {
    console.error('Cart cleanup error:', error);
    return NextResponse.json({ error: 'Failed to run cart cleanup' }, { status: 500 });
  }
}
