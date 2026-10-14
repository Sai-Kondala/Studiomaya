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
      const rateLimit = await checkRateLimitDistributed(`create_order_${clientIp}`, { limit: 30, windowMs: 60_000 });
      if (!rateLimit.allowed) {
        logger.warn('Rate limit exceeded on create-order', { ip: clientIp });
        return rateLimitResponse(rateLimit.resetMs);
      }
    }

    const body = await request.json();
    const { customerName, customerEmail, customerPhone, productId } = body;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      logger.error('Order creation is not configured: Razorpay credentials are missing.');
      return NextResponse.json(
        { error: 'Payment is not configured on the server.' },
        { status: 503 }
      );
    }

    if (
      typeof customerName !== 'string' ||
      !customerName.trim() ||
      typeof customerEmail !== 'string' ||
      !customerEmail.trim() ||
      typeof productId !== 'string' ||
      !productId
    ) {
      return NextResponse.json(
        { error: 'Product and customer details are required.' },
        { status: 400 }
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      logger.error('Order creation is not configured: Supabase server credentials are missing.');
      return NextResponse.json(
        { error: 'Order storage is not configured on the server.' },
        { status: 503 }
      );
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

    // Fetch actual price and name from database and enforce Published status
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('price, name, status')
      .eq('id', productId)
      .single();
      
    if (productError || !product || product.status !== 'Published') {
      return NextResponse.json(
        { error: 'Product not found or unavailable for purchase.' },
        { status: 404 }
      );
    }
    
    const serverPrice = product.price;

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    
    const order = await razorpay.orders.create({
      amount: Math.round(serverPrice * 100), 
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    });

    // Build order record payload, strictly using verified server session user_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderPayload: any = {
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: customerPhone ? customerPhone.trim() : null,
      razorpay_order_id: order.id,
      amount: Math.round(serverPrice * 100) / 100,
      status: 'pending',
    };

    if (verifiedUserId) {
      orderPayload.user_id = verifiedUserId;
    }

    const itemsPayload = [
      {
        product_id: productId,
        unit_price: serverPrice,
        product_name_snapshot: product.name,
      },
    ];

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

      // Gracefully handle case where user_id column has not been added yet in staging/test env
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
        logger.error('Supabase order insert error', directError);
        return NextResponse.json(
          { error: 'The payment order could not be saved. Check the orders table columns and server database credentials.' },
          { status: 500 }
        );
      }

      orderData = directData;

      const { error: itemError } = await supabaseAdmin.from('order_items').insert({
        order_id: orderData.id,
        product_id: productId,
        unit_price: serverPrice,
        product_name_snapshot: product.name,
      });

      if (itemError) {
        logger.error('Supabase order_item insert error', itemError);
        // Compensating rollback: delete incomplete pending order
        await supabaseAdmin.from('orders').delete().eq('id', orderData.id);
        return NextResponse.json(
          { error: 'The payment order items could not be saved.' },
          { status: 500 }
        );
      }
    } else if (insertError) {
      logger.error('Atomic order creation failed via RPC', insertError);
      return NextResponse.json(
        { error: 'The payment order could not be saved. Check the orders table columns and server database credentials.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orderId: order.id });
  } catch (error: unknown) {
    logger.error('Create order error', error);
    return NextResponse.json(
      { error: 'Failed to create the payment order. Check the server logs and required environment variables.' },
      { status: 500 }
    );
  }
}