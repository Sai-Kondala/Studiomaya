import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import {
  getUserCartItems,
  addProductToCart,
  removeProductFromCart,
  clearUserCart,
} from '@/lib/cartService';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, items: [] });
    }

    const { items, expired } = await getUserCartItems(user.id);
    return NextResponse.json({ authenticated: true, items, expired });
  } catch (error) {
    console.error('Cart GET API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve cart' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, productId } = body;

    if (action === 'add' && productId) {
      await addProductToCart(user.id, productId);
    } else if (action === 'remove' && productId) {
      await removeProductFromCart(user.id, productId);
    } else if (action === 'clear') {
      await clearUserCart(user.id);
    }

    const { items } = await getUserCartItems(user.id);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Cart POST API error:', error);
    return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await clearUserCart(user.id);
    return NextResponse.json({ success: true, items: [] });
  } catch (error) {
    console.error('Cart DELETE API error:', error);
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 });
  }
}
