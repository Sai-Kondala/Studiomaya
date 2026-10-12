import { NextResponse } from 'next/server';
import { cleanupExpiredCarts } from '@/lib/cartService';

export async function POST() {
  try {
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
