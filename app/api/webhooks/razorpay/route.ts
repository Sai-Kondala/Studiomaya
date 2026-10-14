import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { linkOrCreateCustomer } from '@/lib/customer';
import { clearUserCart } from '@/lib/cartService';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpayWebhook';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret && process.env.NODE_ENV === 'production') {
      console.error('RAZORPAY_WEBHOOK_SECRET is missing in production.');
      return NextResponse.json(
        { error: 'Webhook secret is not configured in production.' },
        { status: 500 }
      );
    }

    const signature = req.headers.get('x-razorpay-signature');
    if (webhookSecret && !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid Razorpay webhook signature.');
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    if (!event || typeof event.event !== 'string') {
      return NextResponse.json({ error: 'Malformed webhook event.' }, { status: 400 });
    }

    const eventType = event.event;

    // Handle payment capture and order payment confirmation
    if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
      return NextResponse.json({ received: true, ignored: `Event '${eventType}' not monitored.` }, { status: 200 });
    }

    let razorpayOrderId: string | null = null;
    let razorpayPaymentId: string | null = null;

    if (eventType === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      razorpayPaymentId = paymentEntity?.id || null;
      razorpayOrderId = paymentEntity?.order_id || null;
    } else if (eventType === 'order.paid') {
      const orderEntity = event.payload?.order?.entity;
      razorpayOrderId = orderEntity?.id || null;
      razorpayPaymentId = event.payload?.payment?.entity?.id || null;
    }

    if (!razorpayOrderId) {
      return NextResponse.json({ received: true, ignored: 'No razorpay_order_id associated with event.' }, { status: 200 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Fetch matching order record
    let { data: existingOrder, error: checkError } = await supabaseAdmin
      .from('orders')
      .select('id, status, amount, customer_email, customer_name, customer_phone, user_id, email_delivery_status')
      .eq('razorpay_order_id', razorpayOrderId)
      .single();

    if (
      checkError &&
      (checkError.code === '42703' ||
        checkError.code === 'PGRST204' ||
        (typeof checkError.message === 'string' && checkError.message.includes('email_delivery_status')))
    ) {
      const fallback = await supabaseAdmin
        .from('orders')
        .select('id, status, amount, customer_email, customer_name, customer_phone, user_id')
        .eq('razorpay_order_id', razorpayOrderId)
        .single();
      existingOrder = fallback.data as any;
      checkError = fallback.error;
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Supabase status check error in Razorpay webhook:', JSON.stringify(checkError));
      return NextResponse.json({ error: 'Could not verify existing order status.' }, { status: 500 });
    }

    if (!existingOrder) {
      console.warn(`Webhook received for unknown Razorpay order ID: ${razorpayOrderId}`);
      return NextResponse.json(
        { error: 'Order not found for given Razorpay order ID.' },
        { status: 404 }
      );
    }

    // 2. Idempotency Check: Already paid
    if (existingOrder.status === 'paid') {
      // If delivery is still failed, try resending
      if ((existingOrder as any).email_delivery_status === 'failed') {
        try {
          await sendOrderReceiptEmail(existingOrder.id, supabaseAdmin, { force: true });
        } catch (resendErr) {
          console.warn('Webhook delivery retry warning:', resendErr);
        }
      }
      return NextResponse.json(
        { received: true, status: 'already_paid', order_id: existingOrder.id },
        { status: 200 }
      );
    }

    // 3. Atomic state update to 'paid'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = {
      status: 'paid',
      email_delivery_status: 'pending',
    };

    if (razorpayPaymentId) {
      updatePayload.razorpay_payment_id = razorpayPaymentId;
    }

    const selectQuery = supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('razorpay_order_id', razorpayOrderId)
      .neq('status', 'paid')
      .select('id, amount, customer_email, customer_name, customer_phone, user_id');

    let { data: updatedOrder, error: dbError } =
      typeof selectQuery.maybeSingle === 'function'
        ? await selectQuery.maybeSingle()
        : await selectQuery.single();

    const isColErr = (err: any) =>
      err &&
      (err.code === '42703' ||
        err.code === 'PGRST204' ||
        (typeof err.message === 'string' &&
          (err.message.includes('email_delivery_status') || err.message.includes('schema cache'))));

    if (dbError && isColErr(dbError) && updatePayload.email_delivery_status) {
      delete updatePayload.email_delivery_status;
      const retryQuery = supabaseAdmin
        .from('orders')
        .update(updatePayload)
        .eq('razorpay_order_id', razorpayOrderId)
        .neq('status', 'paid')
        .select('id, amount, customer_email, customer_name, customer_phone, user_id');
      const retry =
        typeof retryQuery.maybeSingle === 'function'
          ? await retryQuery.maybeSingle()
          : await retryQuery.single();
      updatedOrder = retry.data;
      dbError = retry.error;
    }

    if (dbError) {
      console.error('Supabase webhook order update error:', JSON.stringify(dbError));
      return NextResponse.json(
        { error: 'Order status transition failed.' },
        { status: 500 }
      );
    }

    // Handled concurrently by client verification
    if (!updatedOrder) {
      return NextResponse.json(
        { received: true, status: 'concurrently_fulfilled', order_id: existingOrder.id },
        { status: 200 }
      );
    }

    // 4. Link customer account profile
    let linkedUserId = updatedOrder.user_id || existingOrder.user_id;
    if (updatedOrder.customer_email) {
      try {
        const customerProfile = await linkOrCreateCustomer(
          {
            id: linkedUserId || 'anonymous',
            email: updatedOrder.customer_email,
            user_metadata: { full_name: updatedOrder.customer_name },
          },
          updatedOrder.customer_phone
        );

        if (customerProfile?.id) {
          try {
            await supabaseAdmin
              .from('orders')
              .update({ customer_id: customerProfile.id })
              .eq('id', updatedOrder.id);
          } catch {
            // Ignored if column pending migration
          }
        }

        if (!linkedUserId && customerProfile?.user_id) {
          linkedUserId = customerProfile.user_id;
        }
      } catch (custErr) {
        console.warn('Customer linking warning in webhook:', custErr);
      }
    }

    // 5. Clear user cart if purchaser has an account
    if (linkedUserId) {
      try {
        await clearUserCart(linkedUserId);
      } catch (clearErr) {
        console.warn('Cart clear warning in webhook:', clearErr);
      }
    }

    // 6. Deliver receipt email and download links
    const deliveryResult = await sendOrderReceiptEmail(updatedOrder.id, supabaseAdmin);
    if (!deliveryResult.success) {
      console.warn(`Webhook receipt email dispatch failed for order ${updatedOrder.id}:`, deliveryResult.error);
    }

    return NextResponse.json(
      { received: true, status: 'fulfilled', order_id: updatedOrder.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Razorpay webhook processing error:', errorMsg);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
