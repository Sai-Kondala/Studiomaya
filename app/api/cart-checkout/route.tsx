import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const { productIds, customerName, customerEmail, customerPhone } = await request.json();
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
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
    if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.trim() ||
        !customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json({ error: 'Customer details are required.' }, { status: 400 });
    }

    // Derive user_id safely from verified server session
    const authUser = await getAuthenticatedUser();
    const verifiedUserId = authUser?.id || null;

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
    const publishedProducts = products.filter((p) => p.status === 'Published' || p.status === undefined);
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

    // 4. Create ONE order record
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

    let { data: orderData, error: insertError } = await supabaseAdmin
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

    if (insertError && isColErr(insertError) && orderPayload.user_id) {
      delete orderPayload.user_id;
      const retry = await supabaseAdmin
        .from('orders')
        .insert(orderPayload)
        .select('id')
        .single();
      orderData = retry.data;
      insertError = retry.error;
    }

    if (insertError || !orderData) {
      console.error('Supabase cart order insert error:', JSON.stringify(insertError));
      return NextResponse.json({ error: 'Failed to save cart order.' }, { status: 500 });
    }

    // 5. Create order_items
    const orderItems = publishedProducts.map(p => ({
      order_id: orderData.id,
      product_id: p.id,
      unit_price: p.price,
      product_name_snapshot: p.name
    }));

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);

    if (itemsError) {
      console.error('Supabase order_items insert error:', JSON.stringify(itemsError));
      // Compensate by deleting incomplete pending order
      await supabaseAdmin.from('orders').delete().eq('id', orderData.id);
      return NextResponse.json({ error: 'Failed to save cart order items.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, amount: Math.round(totalAmount * 100), keyId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cart checkout error:', message);
    return NextResponse.json({ error: 'Failed to process checkout.' }, { status: 500 });
  }
}
