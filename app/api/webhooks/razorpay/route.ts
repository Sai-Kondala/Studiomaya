import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { linkOrCreateCustomer } from '@/lib/customer';
import { clearUserCart } from '@/lib/cartService';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpayWebhook';
import { logger } from '@/lib/logger';

// In-memory LRU set to deduplicate webhook events within the process lifetime
const recentWebhookEventIds = new Set<string>();

export async function POST(req: Request) {
  let eventId: string | null = null;
  let eventClaimed = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabaseAdmin: any = null;

  const failEvent = async (msg: string) => {
    if (eventId && eventClaimed && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('processed_webhook_events')
          .update({ status: 'failed', error_message: msg })
          .eq('event_id', eventId);
      } catch {
        // Table fallback
      }
    }
  };

  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret && process.env.NODE_ENV === 'production') {
      logger.error('RAZORPAY_WEBHOOK_SECRET is missing in production.');
      return NextResponse.json(
        { error: 'Webhook secret is not configured in production.' },
        { status: 500 }
      );
    }

    const signature = req.headers.get('x-razorpay-signature');
    if (webhookSecret && !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.error('Invalid Razorpay webhook signature.');
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
    eventId =
      (typeof event.id === 'string' && event.id.trim()) ||
      req.headers.get('x-razorpay-event-id') ||
      null;

    // 1. In-process Event ID Deduplication check
    if (eventId && recentWebhookEventIds.has(eventId)) {
      logger.info('Duplicate webhook event detected via in-memory event registry', { eventId });
      return NextResponse.json(
        { received: true, status: 'event_already_processed', event_id: eventId },
        { status: 200 }
      );
    }

    // Only process payment.captured and order.paid
    if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
      return NextResponse.json({ received: true, ignored: `Event '${eventType}' not monitored.` }, { status: 200 });
    }

    supabaseAdmin = createSupabaseAdminClient();

    // 2. Persistent Atomic Database Event ID Claim with Safe Retry Support
    if (eventId) {
      try {
        const eventsTable = supabaseAdmin.from('processed_webhook_events');
        if (typeof eventsTable?.insert === 'function') {
          const { error: claimError } = await eventsTable.insert({
            event_id: eventId,
            provider: 'razorpay',
            event_type: eventType,
            status: 'processing',
          });

          if (claimError) {
            // Unique constraint violation (23505): Event ID already exists in registry
            if (
              claimError.code === '23505' ||
              claimError.message?.includes('duplicate key') ||
              claimError.message?.includes('unique constraint')
            ) {
              // Inspect status of existing event record
              if (typeof eventsTable?.select === 'function') {
                const { data: existingRecord } = await eventsTable
                  .select('status, processed_at')
                  .eq('event_id', eventId)
                  .maybeSingle();

                // Case A: Event already successfully fulfilled
                if (existingRecord?.status === 'completed') {
                  recentWebhookEventIds.add(eventId);
                  logger.info('Duplicate webhook event detected (already completed)', { eventId });
                  return NextResponse.json(
                    { received: true, status: 'event_already_processed', event_id: eventId },
                    { status: 200 }
                  );
                }

                // Case B: Previous attempt failed. Allow retry by reclaiming event.
                if (existingRecord?.status === 'failed') {
                  const { error: reclaimError } = await eventsTable
                    .update({
                      status: 'processing',
                      processed_at: new Date().toISOString(),
                      error_message: null,
                    })
                    .eq('event_id', eventId)
                    .eq('status', 'failed');

                  if (!reclaimError) {
                    eventClaimed = true;
                    logger.info('Reclaimed previously failed webhook event for retry', { eventId });
                  }
                } else if (existingRecord?.status === 'processing') {
                  // Case C: Currently in-flight. Check if claim is stale (> 3 minutes old)
                  const isStale =
                    existingRecord.processed_at &&
                    Date.now() - new Date(existingRecord.processed_at).getTime() > 3 * 60 * 1000;

                  if (isStale) {
                    await eventsTable
                      .update({
                        status: 'processing',
                        processed_at: new Date().toISOString(),
                      })
                      .eq('event_id', eventId);
                    eventClaimed = true;
                    logger.warn('Reclaimed stale in-flight webhook claim', { eventId });
                  } else {
                    logger.info('Concurrent webhook event delivery currently processing', { eventId });
                    return NextResponse.json(
                      { received: true, status: 'event_already_processed', event_id: eventId },
                      { status: 200 }
                    );
                  }
                } else {
                  // Unknown status or unrecorded; return 200 to prevent storm
                  recentWebhookEventIds.add(eventId);
                  return NextResponse.json(
                    { received: true, status: 'event_already_processed', event_id: eventId },
                    { status: 200 }
                  );
                }
              } else {
                // Table doesn't support select in mock; treat as already processed
                recentWebhookEventIds.add(eventId);
                return NextResponse.json(
                  { received: true, status: 'event_already_processed', event_id: eventId },
                  { status: 200 }
                );
              }
            } else if (claimError.code !== '42P01' && claimError.code !== 'PGRST204') {
              // Real DB outage; return retryable 500 error
              logger.error('Database error claiming webhook event ID', claimError);
              return NextResponse.json(
                { error: 'Webhook event store temporarily unavailable.' },
                { status: 500 }
              );
            }
          } else {
            eventClaimed = true;
            // Note: recentWebhookEventIds is intentionally populated ONLY upon completion
          }
        }
      } catch (claimErr) {
        logger.error('Exception during webhook event claiming', claimErr);
        return NextResponse.json(
          { error: 'Webhook event store temporarily unavailable.' },
          { status: 500 }
        );
      }
    }

    // 3. Extract and deeply validate event entities
    let razorpayOrderId: string | null = null;
    let razorpayPaymentId: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let paymentEntity: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderEntity: any = null;

    if (eventType === 'payment.captured') {
      paymentEntity = event.payload?.payment?.entity;
      if (!paymentEntity) {
        await failEvent('Missing payment entity in payload.');
        return NextResponse.json({ error: 'Missing payment entity in payload.' }, { status: 400 });
      }

      razorpayPaymentId = paymentEntity.id || null;
      razorpayOrderId = paymentEntity.order_id || null;

      // Validate payment status is 'captured'
      if (paymentEntity.status !== 'captured') {
        logger.warn(`Webhook received for uncaptured payment (status: ${paymentEntity.status}).`, {
          paymentId: razorpayPaymentId,
        });
        await failEvent(`Payment is in '${paymentEntity.status}' status, not captured.`);
        return NextResponse.json(
          { received: true, ignored: `Payment is in '${paymentEntity.status}' status, not captured.` },
          { status: 200 }
        );
      }
    } else if (eventType === 'order.paid') {
      orderEntity = event.payload?.order?.entity;
      paymentEntity = event.payload?.payment?.entity;

      if (!orderEntity) {
        await failEvent('Missing order entity in payload.');
        return NextResponse.json({ error: 'Missing order entity in payload.' }, { status: 400 });
      }

      razorpayOrderId = orderEntity.id || null;
      razorpayPaymentId = paymentEntity?.id || null;

      // Validate order status is 'paid'
      if (orderEntity.status !== 'paid') {
        logger.warn(`Webhook received for unpaid order event (status: ${orderEntity.status}).`, {
          orderId: razorpayOrderId,
        });
        await failEvent(`Order is in '${orderEntity.status}' status, not paid.`);
        return NextResponse.json(
          { received: true, ignored: `Order is in '${orderEntity.status}' status, not paid.` },
          { status: 200 }
        );
      }
    }

    if (!razorpayOrderId) {
      await failEvent('No razorpay_order_id associated with event.');
      return NextResponse.json({ received: true, ignored: 'No razorpay_order_id associated with event.' }, { status: 200 });
    }

    // Validate that payment entity is explicitly bound to the expected razorpay_order_id
    if (paymentEntity && paymentEntity.order_id && paymentEntity.order_id !== razorpayOrderId) {
      logger.error('Payment order mismatch in webhook payload', null, {
        expectedOrder: razorpayOrderId,
        paymentOrder: paymentEntity.order_id,
      });
      await failEvent('Payment entity order_id does not match event order.');
      return NextResponse.json(
        { error: 'Payment entity order_id does not match event order.' },
        { status: 400 }
      );
    }

    // Validate currency is INR
    const eventCurrency = paymentEntity?.currency || orderEntity?.currency;
    if (!eventCurrency || typeof eventCurrency !== 'string' || eventCurrency.toUpperCase() !== 'INR') {
      logger.error('Invalid currency in webhook payload', null, { currency: eventCurrency });
      await failEvent('Payment currency does not match INR.');
      return NextResponse.json(
        { error: 'Payment currency does not match INR.' },
        { status: 400 }
      );
    }

    // 4. Fetch matching order record from database
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
      logger.error('Supabase status check error in Razorpay webhook', checkError);
      return NextResponse.json({ error: 'Could not verify existing order status.' }, { status: 500 });
    }

    if (!existingOrder) {
      logger.warn(`Webhook received for unknown Razorpay order ID: ${razorpayOrderId}`);
      await failEvent(`Order not found for given Razorpay order ID: ${razorpayOrderId}`);
      return NextResponse.json(
        { error: 'Order not found for given Razorpay order ID.' },
        { status: 404 }
      );
    }

    // 5. Deep validation of payment amount against stored database order total
    const expectedAmountPaise = Math.round(Number(existingOrder.amount) * 100);

    if (paymentEntity?.amount !== undefined) {
      const receivedAmountPaise = Number(paymentEntity.amount);
      if (receivedAmountPaise !== expectedAmountPaise) {
        logger.error('Webhook captured payment amount mismatch against stored order', null, {
          orderId: existingOrder.id,
          expectedPaise: expectedAmountPaise,
          receivedPaise: receivedAmountPaise,
        });
        await failEvent('Payment amount does not match stored order amount.');
        return NextResponse.json(
          { error: 'Payment amount does not match stored order amount.' },
          { status: 400 }
        );
      }
    } else if (orderEntity?.amount_paid !== undefined) {
      const receivedAmountPaise = Number(orderEntity.amount_paid);
      if (receivedAmountPaise !== expectedAmountPaise) {
        logger.error('Webhook paid order amount mismatch against stored order', null, {
          orderId: existingOrder.id,
          expectedPaise: expectedAmountPaise,
          receivedPaise: receivedAmountPaise,
        });
        await failEvent('Paid order amount does not match stored order amount.');
        return NextResponse.json(
          { error: 'Paid order amount does not match stored order amount.' },
          { status: 400 }
        );
      }
    }

    // 6. Idempotency Check: Already paid
    if (existingOrder.status === 'paid') {
      // If delivery is still failed, try resending
      if ((existingOrder as any).email_delivery_status === 'failed') {
        try {
          await sendOrderReceiptEmail(existingOrder.id, supabaseAdmin, { force: true });
        } catch (resendErr) {
          logger.warn('Webhook delivery retry warning', { error: String(resendErr) });
        }
      }

      if (eventId) {
        recentWebhookEventIds.add(eventId);
      }

      return NextResponse.json(
        { received: true, status: 'already_paid', order_id: existingOrder.id },
        { status: 200 }
      );
    }

    // 7. Atomic state update to 'paid'
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
      logger.error('Supabase webhook order update error', dbError);
      return NextResponse.json(
        { error: 'Order status transition failed.' },
        { status: 500 }
      );
    }

    // Handled concurrently by client verification
    if (!updatedOrder) {
      if (eventId) {
        recentWebhookEventIds.add(eventId);
      }
      return NextResponse.json(
        { received: true, status: 'concurrently_fulfilled', order_id: existingOrder.id },
        { status: 200 }
      );
    }

    // 8. Link customer account profile
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
        logger.warn('Customer linking warning in webhook', { error: String(custErr) });
      }
    }

    // 9. Clear user cart if purchaser has an account
    if (linkedUserId) {
      try {
        await clearUserCart(linkedUserId);
      } catch (clearErr) {
        logger.warn('Cart clear warning in webhook', { error: String(clearErr) });
      }
    }

    // 10. Deliver receipt email and download links
    const deliveryResult = await sendOrderReceiptEmail(updatedOrder.id, supabaseAdmin);
    if (!deliveryResult.success) {
      logger.warn(`Webhook receipt email dispatch failed for order ${updatedOrder.id}`, {
        error: deliveryResult.error,
      });
    }

    // 11. Finalize claimed event ID to persistent registry and in-memory set
    if (eventId) {
      recentWebhookEventIds.add(eventId);
      if (recentWebhookEventIds.size > 2000) {
        const firstKey = recentWebhookEventIds.values().next().value;
        if (firstKey) recentWebhookEventIds.delete(firstKey);
      }

      try {
        const eventsTable = supabaseAdmin.from('processed_webhook_events');
        if (eventClaimed && typeof eventsTable?.update === 'function') {
          await eventsTable
            .update({
              status: 'completed',
              order_id: updatedOrder.id,
            })
            .eq('event_id', eventId);
        } else if (typeof eventsTable?.insert === 'function') {
          await eventsTable.insert({
            event_id: eventId,
            provider: 'razorpay',
            event_type: eventType,
            status: 'completed',
            order_id: updatedOrder.id,
          });
        }
      } catch {
        // Table migration pending fallback
      }
    }

    return NextResponse.json(
      { received: true, status: 'fulfilled', order_id: updatedOrder.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Razorpay webhook processing error', error);

    // If an error occurred mid-flight, transition claim to 'failed' and purge memory so Razorpay retries can succeed
    if (eventId) {
      recentWebhookEventIds.delete(eventId);
      if (eventClaimed) {
        try {
          await supabaseAdmin
            .from('processed_webhook_events')
            .update({
              status: 'failed',
              error_message: errorMsg,
            })
            .eq('event_id', eventId);
        } catch {
          // Ignored if table unavailable
        }
      }
    }

    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
