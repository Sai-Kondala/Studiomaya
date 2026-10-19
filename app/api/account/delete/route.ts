import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to delete your account.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const userId = user.id;
    const normalizedEmail = user.email ? user.email.toLowerCase().trim() : '';

    logger.info('Initiating customer account deletion', { userId, email: normalizedEmail });

    // 1. Delete user's cart items and cart
    try {
      const { data: userCarts } = await supabaseAdmin
        .from('carts')
        .select('id')
        .eq('user_id', userId);

      if (userCarts && userCarts.length > 0) {
        const cartIds = userCarts.map((c) => c.id);
        await supabaseAdmin.from('cart_items').delete().in('cart_id', cartIds);
        await supabaseAdmin.from('carts').delete().eq('user_id', userId);
      }
    } catch (cartErr) {
      logger.warn('Non-critical cart cleanup warning during account deletion:', { error: cartErr });
    }

    // 2. Collect and delete user's order items and orders (their records only)
    try {
      let orderIdsToDelete: string[] = [];

      const { data: ordersByUid } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('user_id', userId);

      if (ordersByUid) {
        orderIdsToDelete.push(...ordersByUid.map((o) => o.id));
      }

      if (normalizedEmail) {
        const { data: ordersByEmail } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('customer_email', normalizedEmail);

        if (ordersByEmail) {
          orderIdsToDelete.push(...ordersByEmail.map((o) => o.id));
        }
      }

      orderIdsToDelete = Array.from(new Set(orderIdsToDelete));

      if (orderIdsToDelete.length > 0) {
        await supabaseAdmin.from('order_items').delete().in('order_id', orderIdsToDelete);
        await supabaseAdmin.from('orders').delete().in('id', orderIdsToDelete);
      }
    } catch (orderErr) {
      logger.warn('Non-critical orders cleanup warning during account deletion:', { error: orderErr });
    }

    // 3. Delete customer profile in public.customers
    try {
      await supabaseAdmin.from('customers').delete().eq('user_id', userId);
      if (normalizedEmail) {
        await supabaseAdmin.from('customers').delete().eq('email', normalizedEmail);
      }
    } catch (custErr) {
      logger.warn('Non-critical customer record cleanup warning during account deletion:', { error: custErr });
    }

    // 4. Delete the user from Supabase Auth (auth.users)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      logger.error('Failed to delete auth user from Supabase auth admin:', { error: authDeleteError });
      return NextResponse.json(
        { error: 'Failed to completely delete account auth credentials. Please try again.' },
        { status: 500 }
      );
    }

    logger.info('Account deleted successfully', { userId });

    const response = NextResponse.json({
      success: true,
      message: 'Your account and personal records have been permanently deleted.',
    });

    // 5. Expire and clear all auth cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    allCookies.forEach((c) => {
      if (
        c.name.startsWith('sb-') ||
        c.name.includes('auth') ||
        c.name.includes('token') ||
        c.name.includes('session')
      ) {
        response.cookies.set(c.name, '', { path: '/', maxAge: 0, expires: new Date(0) });
      }
    });
    response.cookies.set('sb-auth-token', '', { path: '/', maxAge: 0, expires: new Date(0) });

    return response;
  } catch (error: unknown) {
    logger.error('Unexpected error in account deletion API:', { error });
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
