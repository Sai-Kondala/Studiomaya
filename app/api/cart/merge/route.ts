import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { mergeAnonymousCartIntoUser } from '@/lib/cartService';
import { linkOrCreateCustomer, linkGuestOrdersForUser } from '@/lib/customer';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reconcile customer profile and unassigned guest orders for verified user
    try {
      await linkOrCreateCustomer(user);
      if (user.email) {
        await linkGuestOrdersForUser(user.id, user.email);
      }
    } catch (reconcileErr) {
      console.warn('Customer/order reconciliation post-login warning:', reconcileErr);
    }

    const body = await request.json();
    if (!body || !Array.isArray(body.productIds)) {
      return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 });
    }

    const productIds: string[] = body.productIds
      .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id: string) => id.trim());

    if (productIds.length > 50) {
      return NextResponse.json({ error: 'Cart merge exceeds maximum limit of 50 items.' }, { status: 400 });
    }

    const { items, expired } = await mergeAnonymousCartIntoUser(user.id, productIds);
    return NextResponse.json({ success: true, items, expired });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to merge cart';
    console.error('Cart merge API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
