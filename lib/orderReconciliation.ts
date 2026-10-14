import Razorpay from 'razorpay';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { linkOrCreateCustomer } from '@/lib/customer';
import { clearUserCart } from '@/lib/cartService';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';
import { logger } from '@/lib/logger';

export interface ReconciliationReport {
  checked: number;
  reconciled: number;
  expiredOrCancelled: number;
  skipped: number;
  errors: Array<{ orderId: string; error: string }>;
}

/**
 * Reconciles stuck pending orders against Razorpay.
 * Identifies orders where the customer paid but the client-side redirect or webhook failed,
 * and automatically triggers fulfillment (database update, customer linking, receipt delivery).
 */
export async function reconcilePendingOrders(
  options: { maxAgeMinutes?: number; limit?: number } = {}
): Promise<ReconciliationReport> {
  const maxAgeMinutes = options.maxAgeMinutes ?? 15;
  const limit = options.limit ?? 50;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  const report: ReconciliationReport = {
    checked: 0,
    reconciled: 0,
    expiredOrCancelled: 0,
    skipped: 0,
    errors: [],
  };

  if (!keyId || !keySecret) {
    logger.warn('Reconciliation skipped: Razorpay credentials are not configured.');
    return report;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  // 1. Fetch pending orders older than maxAgeMinutes
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  const { data: pendingOrders, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, amount, status, razorpay_order_id, customer_email, customer_name, customer_phone, user_id, created_at')
    .eq('status', 'pending')
    .lt('created_at', cutoffTime)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fetchError || !pendingOrders) {
    logger.error('Failed to query pending orders for reconciliation', fetchError);
    return report;
  }

  report.checked = pendingOrders.length;

  for (const order of pendingOrders) {
    if (!order.razorpay_order_id) {
      report.skipped++;
      continue;
    }

    try {
      // 2. Query Razorpay API for canonical order state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzpOrder: any = await razorpay.orders.fetch(order.razorpay_order_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzpPayments: any = await razorpay.orders.fetchPayments(order.razorpay_order_id);

      const items = Array.isArray(rzpPayments?.items) ? rzpPayments.items : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capturedPayment = items.find((p: any) => p.status === 'captured');

      const isPaid = rzpOrder.status === 'paid' || Boolean(capturedPayment);

      if (isPaid) {
        // 3. Amount validation check
        const expectedPaise = Math.round(Number(order.amount) * 100);
        const actualPaise = Number(capturedPayment?.amount ?? rzpOrder.amount_paid ?? 0);

        if (actualPaise !== expectedPaise) {
          logger.error('Reconciliation amount mismatch detected for pending order', null, {
            orderId: order.id,
            expectedPaise,
            actualPaise,
          });
          report.errors.push({
            orderId: order.id,
            error: `Amount mismatch: expected ${expectedPaise} paise, received ${actualPaise} paise`,
          });
          continue;
        }

        const paymentId = capturedPayment?.id || null;

        // 4. Atomic conditional transition to paid
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: any = {
          status: 'paid',
          email_delivery_status: 'pending',
        };
        if (paymentId) {
          updatePayload.razorpay_payment_id = paymentId;
        }

        const { data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('orders')
          .update(updatePayload)
          .eq('id', order.id)
          .neq('status', 'paid')
          .select('id, amount, customer_email, customer_name, customer_phone, user_id')
          .maybeSingle();

        if (updateError) {
          logger.error(`Reconciliation failed to update order ${order.id}`, updateError);
          report.errors.push({ orderId: order.id, error: updateError.message });
          continue;
        }

        if (updatedOrder) {
          // 5. Post-fulfillment actions
          let linkedUserId = updatedOrder.user_id;
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
                await supabaseAdmin
                  .from('orders')
                  .update({ customer_id: customerProfile.id })
                  .eq('id', updatedOrder.id);
              }
              if (!linkedUserId && customerProfile?.user_id) {
                linkedUserId = customerProfile.user_id;
              }
            } catch (custErr) {
              logger.warn('Customer linking warning during reconciliation', { error: String(custErr) });
            }
          }

          if (linkedUserId) {
            try {
              await clearUserCart(linkedUserId);
            } catch (cartErr) {
              logger.warn('Cart clear warning during reconciliation', { error: String(cartErr) });
            }
          }

          // 6. Deliver receipt email
          try {
            await sendOrderReceiptEmail(updatedOrder.id, supabaseAdmin);
          } catch (emailErr) {
            logger.warn('Receipt dispatch warning during reconciliation', { error: String(emailErr) });
          }

          logger.info(`Reconciled and fulfilled pending order ${order.id} from Razorpay payment ${paymentId}`);
          report.reconciled++;
        }
      } else {
        // Order remains unpaid. Check if order is ancient (> 48 hours)
        const orderAgeHours = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
        if (orderAgeHours > 48) {
          await supabaseAdmin
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', order.id)
            .eq('status', 'pending');

          report.expiredOrCancelled++;
        } else {
          report.skipped++;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Reconciliation check error for order ${order.id}`, err);
      report.errors.push({ orderId: order.id, error: msg });
    }
  }

  return report;
}
