import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { linkOrCreateCustomer } from '@/lib/customer';
import { clearUserCart } from '@/lib/cartService';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string' ||
      !/^[a-f\d]{64}$/i.test(razorpay_signature)
    ) {
      return NextResponse.json(
        { error: 'Payment verification data is incomplete or invalid.' },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!secret || !keyId) {
      return NextResponse.json(
        { error: 'Payment verification is not configured on the server.' },
        { status: 503 }
      );
    }

    // 1. Verify HMAC SHA256 signature
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    const expectedSignatureBuffer = Buffer.from(generatedSignature, 'hex');
    const receivedSignatureBuffer = Buffer.from(razorpay_signature, 'hex');
    if (!crypto.timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer)) {
      return NextResponse.json(
        { error: 'Razorpay signature did not match.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 2. Fetch the existing pending order from database
    let { data: existingOrder, error: checkError } = await supabaseAdmin
      .from('orders')
      .select('id, status, amount, customer_email, customer_name, customer_phone, user_id, email_delivery_status')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (checkError && (checkError.code === '42703' || checkError.code === 'PGRST204' || (typeof checkError.message === 'string' && checkError.message.includes('email_delivery_status')))) {
      const fallback = await supabaseAdmin
        .from('orders')
        .select('id, status, amount, customer_email, customer_name, customer_phone, user_id')
        .eq('razorpay_order_id', razorpay_order_id)
        .single();
      existingOrder = fallback.data as any;
      checkError = fallback.error;
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Supabase status check error:', JSON.stringify(checkError));
      return NextResponse.json(
        { error: 'Could not verify existing order status.' },
        { status: 500 }
      );
    }

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Payment was verified, but no matching order was found.' },
        { status: 404 }
      );
    }

    // Idempotent delivery check: if already paid, verify delivery status and retry email if failed
    if (existingOrder.status === 'paid') {
      // If delivery already confirmed, do not resend
      if ((existingOrder as any).email_delivery_status === 'delivered') {
        return NextResponse.json({ success: true, message: 'Payment already verified' }, { status: 200 });
      }

      // If email delivery previously failed, retry delivery
      if ((existingOrder as any).email_delivery_status === 'failed') {
        try {
          const retryResult = await sendOrderReceiptEmail(existingOrder.id, supabaseAdmin);
          if (retryResult.success) {
            return NextResponse.json({ success: true, message: 'Cart Payment verified and receipt delivered successfully' }, { status: 200 });
          }
        } catch (retryErr) {
          console.error('Failed to retry email delivery for cart order:', retryErr);
        }
      }

      return NextResponse.json({ success: true, message: 'Payment already verified' }, { status: 200 });
    }

    // 3. Server-side validation with Razorpay API (verifies captured status, amount, and order binding)
    const razorpay = new Razorpay({ key_id: keyId, key_secret: secret });
    let payment: any;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (rzpErr) {
      console.error('Failed to fetch payment details from Razorpay API:', rzpErr);
      return NextResponse.json(
        { error: 'Could not fetch payment details from payment gateway.' },
        { status: 502 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment record could not be found on Razorpay.' },
        { status: 400 }
      );
    }

    if (payment.order_id !== razorpay_order_id) {
      console.error(`Payment order mismatch: expected ${razorpay_order_id}, got ${payment.order_id}`);
      return NextResponse.json(
        { error: 'Payment does not belong to the specified order.' },
        { status: 400 }
      );
    }

    const expectedAmountPaise = Math.round(Number(existingOrder.amount) * 100);
    if (Number(payment.amount) !== expectedAmountPaise) {
      console.error(`Payment amount mismatch: expected ${expectedAmountPaise}, got ${payment.amount}`);
      return NextResponse.json(
        { error: 'Captured payment amount does not match the order total.' },
        { status: 400 }
      );
    }

    if (!payment.currency || typeof payment.currency !== 'string' || payment.currency.toUpperCase() !== 'INR') {
      return NextResponse.json(
        { error: 'Payment currency does not match or is missing. Expected INR.' },
        { status: 400 }
      );
    }

    if (payment.status === 'authorized') {
      try {
        payment = await razorpay.payments.capture(razorpay_payment_id, expectedAmountPaise, 'INR');
      } catch (captureErr) {
        console.error('Failed to capture authorized Razorpay payment:', captureErr);
        return NextResponse.json(
          { error: 'Payment authorization could not be captured. Money was not collected.' },
          { status: 400 }
        );
      }
    }

    if (payment.status !== 'captured') {
      return NextResponse.json(
        { error: `Payment is not in an accepted state (status: ${payment.status}). Orders can only be fulfilled for captured payments.` },
        { status: 400 }
      );
    }

    // 4. Derive customer user ID securely: preserve existing owner, or link unowned order if identity matches
    const authUser = await getAuthenticatedUser();
    let verifiedUserId: string | null = existingOrder.user_id || null;

    if (!verifiedUserId && authUser?.id && authUser.email && existingOrder.customer_email) {
      if (authUser.email.trim().toLowerCase() === existingOrder.customer_email.trim().toLowerCase()) {
        verifiedUserId = authUser.id;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = {
      status: 'paid',
      razorpay_payment_id: razorpay_payment_id,
      email_delivery_status: 'pending',
    };

    if (verifiedUserId) {
      updatePayload.user_id = verifiedUserId;
    }

    // 5. Atomic state transition: transition only if status is NOT already paid
    const selectQuery = supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('razorpay_order_id', razorpay_order_id)
      .neq('status', 'paid')
      .select('id, amount, customer_email, customer_name, customer_phone');

    let { data: updatedOrder, error: dbError } = typeof selectQuery.maybeSingle === 'function'
      ? await selectQuery.maybeSingle()
      : await selectQuery.single();

    const isColErr = (err: any) =>
      err &&
      (err.code === '42703' ||
        err.code === 'PGRST204' ||
        (typeof err.message === 'string' &&
          (err.message.includes('user_id') ||
            err.message.includes('email_delivery_status') ||
            err.message.includes('schema cache'))));

    if (dbError && isColErr(dbError) && (updatePayload.user_id || updatePayload.email_delivery_status)) {
      delete updatePayload.user_id;
      delete updatePayload.email_delivery_status;
      const retryQuery = supabaseAdmin
        .from('orders')
        .update(updatePayload)
        .eq('razorpay_order_id', razorpay_order_id)
        .neq('status', 'paid')
        .select('id, amount, customer_email, customer_name, customer_phone');
      const retry = typeof retryQuery.maybeSingle === 'function'
        ? await retryQuery.maybeSingle()
        : await retryQuery.single();
      updatedOrder = retry.data;
      dbError = retry.error;
    }

    if (dbError) {
      console.error('Supabase payment update error:', JSON.stringify(dbError));
      return NextResponse.json(
        { error: 'The payment was verified, but the order could not be updated.' },
        { status: 500 }
      );
    }

    // If another concurrent request transitioned the order between our check and update:
    if (!updatedOrder) {
      const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('razorpay_order_id', razorpay_order_id)
        .single();
      if (currentOrder && currentOrder.status === 'paid') {
        return NextResponse.json({ success: true, message: 'Payment already verified' }, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Payment was verified, but no matching order was found.' },
        { status: 404 }
      );
    }

    // 6. Link customer account record
    let linkedUserId = verifiedUserId;
    if (updatedOrder.customer_email) {
      try {
        const customerProfile = await linkOrCreateCustomer(
          {
            id: verifiedUserId || 'anonymous',
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
            // Ignored if column is pending migration
          }
        }
        if (!linkedUserId && customerProfile?.user_id) {
          linkedUserId = customerProfile.user_id;
        }
      } catch (custErr) {
        console.warn('Customer linking warning:', custErr);
      }
    }

    // 7. Clear active cart in Supabase upon verified checkout (only for verified user)
    if (linkedUserId) {
      try {
        await clearUserCart(linkedUserId);
      } catch (clearErr) {
        console.warn('Cart clear warning after purchase:', clearErr);
      }
    }

    // 8. Deliver receipt email and download links using consolidated delivery service
    const deliveryResult = await sendOrderReceiptEmail(updatedOrder.id, supabaseAdmin);
    if (!deliveryResult.success) {
      console.warn(`Cart receipt email dispatch failed for order ${updatedOrder.id}:`, deliveryResult.error);
    }

    return NextResponse.json({ success: true, message: 'Cart Payment verified successfully' }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Payment verification error:', errorMessage);
    return NextResponse.json(
      { error: 'Payment verification could not be completed.' },
      { status: 500 }
    );
  }
}
