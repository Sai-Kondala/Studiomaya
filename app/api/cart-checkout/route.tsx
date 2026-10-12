import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { productIds, customerName, customerEmail, customerPhone, userId } = await request.json();
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment is not configured on the server.' }, { status: 503 });
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Validate inputs
    if (!customerEmail || !customerName) {
      return NextResponse.json({ error: 'Customer details are required.' }, { status: 400 });
    }

    // 2. Fetch canonical prices and names for all products from DB
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, price, name')
      .in('id', productIds);

    if (productsError || !products || products.length === 0) {
      return NextResponse.json({ error: 'Failed to retrieve product details.' }, { status: 500 });
    }

    // Calculate total on server (never trust client prices)
    const totalAmount = products.reduce((acc, p) => acc + Number(p.price), 0);

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

    if (userId) {
      orderPayload.user_id = userId;
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
    const orderItems = products.map(p => ({
      order_id: orderData.id,
      product_id: p.id,
      unit_price: p.price,
      product_name_snapshot: p.name
    }));

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);

    if (itemsError) {
      console.error('Supabase order_items insert error:', JSON.stringify(itemsError));
      return NextResponse.json({ error: 'Failed to save cart order items.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, amount: Math.round(totalAmount * 100), keyId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cart checkout error:', message);
    return NextResponse.json({ error: 'Failed to process checkout.' }, { status: 500 });
  }
}
