import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { mergeAnonymousCartIntoUser } from '@/lib/cartService';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const productIds: string[] = Array.isArray(body.productIds) ? body.productIds : [];

    const { items, expired } = await mergeAnonymousCartIntoUser(user.id, productIds);
    return NextResponse.json({ success: true, items, expired });
  } catch (error) {
    console.error('Cart merge API error:', error);
    return NextResponse.json({ error: 'Failed to merge cart' }, { status: 500 });
  }
}
