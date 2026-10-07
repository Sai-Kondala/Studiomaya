import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { price, customerName, customerEmail, productId } = await request.json();
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Order creation is not configured: Razorpay credentials are missing.');
      return NextResponse.json(
        { error: 'Payment is not configured on the server.' },
        { status: 503 }
      );
    }

    if (
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price <= 0 ||
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
      console.error('Order creation is not configured: Supabase server credentials are missing.');
      return NextResponse.json(
        { error: 'Order storage is not configured on the server.' },
        { status: 503 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    
    const order = await razorpay.orders.create({
      amount: Math.round(price * 100), 
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    });

    const { error } = await supabaseAdmin.from('orders').insert({
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      product_id: productId,
      razorpay_order_id: order.id,
      amount: Math.round(price * 100) / 100,
      status: 'pending',
    });

    if (error) {
      console.error('Supabase order insert error:', JSON.stringify(error));
      return NextResponse.json(
        { error: 'The payment order could not be saved. Check the orders table columns and server database credentials.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orderId: order.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Create order error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create the payment order. Check the server logs and required environment variables.' },
      { status: 500 }
    );
  }
}