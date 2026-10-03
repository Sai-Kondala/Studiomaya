import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { supabase } from '../../../lib/supabase';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  try {
    const { price, email, productId } = await request.json();
    
    // 1. Create the Razorpay Order
    const order = await razorpay.orders.create({
      amount: price * 100, 
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    });

    // 2. Save a 'pending' order into your Supabase database
    const { error } = await supabase.from('orders').insert({
      customer_email: email,
      product_id: productId,
      razorpay_order_id: order.id,
      status: 'pending'
    });

    if (error) throw error;

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}