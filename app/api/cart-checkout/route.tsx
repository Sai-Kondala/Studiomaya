import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { checkRateLimitDistributed, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== 'test') {
      const clientIp = getClientIp(request);
      const rateLimit = await checkRateLimitDistributed(`cart_checkout_${clientIp}`, { limit: 30, windowMs: 60_000 });
      if (!rateLimit.allowed) {
        logger.warn('Rate limit exceeded on cart-checkout', { ip: clientIp });
        return rateLimitResponse(rateLimit.resetMs);
      }
    }

    const { productIds, customerName, customerEmail, customerPhone } = await request.json();
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      logger.error('Payment configuration missing for cart-checkout');
      return NextResponse.json({ error: 'Payment is not configured on the server.' }, { status: 503 });
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    // Deduplicate product IDs to prevent double charging or inflated totals
    const uniqueProductIds = Array.from(new Set(productIds.filter((id) => typeof id === 'string' && id.trim() !== '')));

    if (uniqueProductIds.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    if (uniqueProductIds.length > 50) {
      return NextResponse.json({ error: 'Cart exceeds maximum limit of 50 items.' }, { status: 400 });
    }

    // Validate customer inputs
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !customerEmail ||
      typeof customerEmail !== 'string' ||
      customerEmail.trim().length > 254 ||
      !EMAIL_REGEX.test(customerEmail.trim()) ||
      !customerName ||
      typeof customerName !== 'string' ||
      customerName.trim().length < 1 ||
      customerName.trim().length > 120
    ) {
      return NextResponse.json({ error: 'Customer details are required.' }, { status: 400 });
    }

    // Derive user_id safely: only assign to authenticated account if submitted email matches the account's verified email.
    // If a signed-in user checks out with a different email, explicitly treat it as an unassigned guest order.
    const authUser = await getAuthenticatedUser();
    let verifiedUserId: string | null = null;
    if (authUser?.id && authUser.email && customerEmail) {
      if (authUser.email.trim().toLowerCase() === customerEmail.trim().toLowerCase()) {
        verifiedUserId = authUser.id;
      }
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 2. Fetch canonical prices and names for all products from DB
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, price, name, status')
      .in('id', uniqueProductIds);

    if (productsError || !products) {
      return NextResponse.json({ error: 'Failed to retrieve product details.' }, { status: 500 });
    }

    // Verify all requested products exist and are currently published
    const publishedProducts = products.filter((p) => p.status === 'Published');
    if (publishedProducts.length !== uniqueProductIds.length) {
      return NextResponse.json(
        { error: 'One or more items in your cart are no longer available.' },
        { status: 400 }
      );
    }

    // Calculate total on server (never trust client prices)
    const totalAmount = publishedProducts.reduce((acc, p) => acc + Number(p.price), 0);

    // 3. Create Razorpay order
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), 
      currency: 'INR',
      receipt: `cart_${Date.now()}`,
    });

    // 4. Create order payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderPayload: any = {
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: customerPhone ? customerPhone.trim() : null,
      razorpay_order_id: order.id,
      amount: Math.round(totalAmount * 100) / 100,
      status: 'pending',
    };

    if (verifiedUserId) {
      orderPayload.user_id = verifiedUserId;
    }

    const itemsPayload = publishedProducts.map((p) => ({
      product_id: p.id,
      unit_price: p.price,
      product_name_snapshot: p.name,
    }));

    let orderData: { id: string } | null = null;
    let insertError: any = null;

    // 1. Attempt transactional atomic insert via database RPC
    try {
      if (typeof supabaseAdmin.rpc === 'function') {
        const rpcResult = await supabaseAdmin.rpc('create_order_atomic', {
          p_order: orderPayload,
          p_items: itemsPayload,
        });

        if (!rpcResult.error && rpcResult.data) {
          orderData = { id: rpcResult.data };
        } else if (
          rpcResult.error &&
          rpcResult.error.code !== 'PGRST202' &&
          rpcResult.error.code !== '42883'
        ) {
          insertError = rpcResult.error;
        }
      }
    } catch {
      // Fall through to fallback insert below
    }

    // 2. Fallback to direct insert if RPC not present in environment
    if (!orderData && !insertError) {
      let { data: directData, error: directError } = await supabaseAdmin
        .from('orders')
        .insert(orderPayload)
        .select('id')
        .single();

      // Graceful fallback if user_id column is not yet present
      const isColErr = (err: any) =>
        err &&
        (err.code === '42703' ||
          err.code === 'PGRST204' ||
          (typeof err.message === 'string' && (err.message.includes('user_id') || err.message.includes('schema cache'))));

      if (directError && isColErr(directError) && orderPayload.user_id) {
        delete orderPayload.user_id;
        const retry = await supabaseAdmin
          .from('orders')
          .insert(orderPayload)
          .select('id')
          .single();
        directData = retry.data;
        directError = retry.error;
      }

      if (directError || !directData) {
        logger.error('Supabase cart order insert error', directError);
        return NextResponse.json({ error: 'Failed to save cart order.' }, { status: 500 });
      }

      orderData = directData;

      const orderItems = publishedProducts.map((p) => ({
        order_id: orderData!.id,
        product_id: p.id,
        unit_price: p.price,
        product_name_snapshot: p.name,
      }));

      const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);

      if (itemsError) {
        logger.error('Supabase order_items insert error', itemsError);
        // Compensate by deleting incomplete pending order
        await supabaseAdmin.from('orders').delete().eq('id', orderData.id);
        return NextResponse.json({ error: 'Failed to save cart order items.' }, { status: 500 });
      }
    } else if (insertError) {
      logger.error('Atomic cart order creation failed via RPC', insertError);
      return NextResponse.json({ error: 'Failed to save cart order.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, amount: Math.round(totalAmount * 100), keyId });
  } catch (error: unknown) {
    logger.error('Cart checkout error', error);
    return NextResponse.json({ error: 'Failed to process checkout.' }, { status: 500 });
  }
}
