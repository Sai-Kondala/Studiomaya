import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

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

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Resolve Customer OR Create new one
    let customerId = null;
    if (customerEmail && customerName) {
      // Upsert customer
      const { data: existingCustomer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('email', customerEmail.trim())
        .maybeSingle();
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
        // Optionally update phone if it was provided
        if (customerPhone) {
          await supabaseAdmin.from('customers').update({ phone: customerPhone, full_name: customerName }).eq('id', customerId);
        }
      } else {
        const { data: newCustomer } = await supabaseAdmin
          .from('customers')
          .insert({
            email: customerEmail.trim(),
            full_name: customerName.trim(),
            phone: customerPhone || null
          })
          .select('id')
          .single();
        if (newCustomer) customerId = newCustomer.id;
      }
    }

    // 2. Fetch current prices for all products
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (productsError || !products || products.length === 0) {
      return NextResponse.json({ error: 'Failed to retrieve product details.' }, { status: 500 });
    }

    // Calculate total on server
    const totalAmount = products.reduce((acc, p) => acc + Number(p.price), 0);

    // 3. Create Razorpay order
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), 
      currency: 'INR',
      receipt: `cart_${Date.now()}`,
    });

    // 4. Create order records (one for each product to support existing schema)
    const orderInserts = products.map(p => ({
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      Customer_Phone: customerPhone ? parseInt(customerPhone.replace(/\\D/g, ''), 10) : null,
      product_id: p.id,
      razorpay_order_id: order.id,
      amount: p.price,
      status: 'pending',
    }));

    const { error: insertError } = await supabaseAdmin.from('orders').insert(orderInserts);

    if (insertError) {
      console.error('Supabase cart order insert error:', JSON.stringify(insertError));
      return NextResponse.json({ error: 'Failed to save cart orders.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, amount: Math.round(totalAmount * 100), keyId });
  } catch (error: any) {
    console.error('Cart checkout error:', error);
    return NextResponse.json({ error: 'Failed to process checkout.' }, { status: 500 });
  }
}
