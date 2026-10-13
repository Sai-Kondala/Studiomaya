import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

/**
 * Verifies Svix webhook signatures sent by Resend if RESEND_WEBHOOK_SECRET is set.
 */
function verifyResendWebhookSignature(
  payload: string,
  headers: Headers,
  secret?: string
): boolean {
  if (!secret) return true; // If no secret configured, allow in dev/staging

  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Prevent replay attacks (check within 5 minutes)
  const timestampSec = parseInt(svixTimestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(timestampSec) || Math.abs(nowSec - timestampSec) > 300) {
    return false;
  }

  try {
    const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const secretBuffer = Buffer.from(rawSecret, 'base64');
    const toSign = `${svixId}.${svixTimestamp}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', secretBuffer).update(toSign).digest('base64');

    const signatures = svixSignature.split(' ');
    for (const versionedSig of signatures) {
      const [version, sig] = versionedSig.split(',');
      if (version === 'v1' && sig) {
        const sigBuf = Buffer.from(sig);
        const expectedBuf = Buffer.from(expectedSig);
        if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret && process.env.NODE_ENV === 'production') {
      console.error('RESEND_WEBHOOK_SECRET is missing in production.');
      return NextResponse.json(
        { error: 'Webhook secret is not configured in production.' },
        { status: 500 }
      );
    }

    if (webhookSecret && !verifyResendWebhookSignature(rawBody, req.headers, webhookSecret)) {
      console.error('Invalid Resend webhook signature.');
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    if (!event || !event.type || !event.data) {
      return NextResponse.json({ error: 'Malformed webhook event.' }, { status: 400 });
    }

    const { type, data } = event;
    const tags = Array.isArray(data.tags) ? data.tags : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderIdTag = tags.find((t: any) => t.name === 'order_id');
    const orderId = orderIdTag?.value;

    if (!orderId) {
      // Event may be from another email outside order receipts
      return NextResponse.json({ received: true, ignored: 'No order_id tag found.' }, { status: 200 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    let newStatus: string | null = null;

    switch (type) {
      case 'email.delivered':
        newStatus = 'delivered';
        break;
      case 'email.bounced':
        newStatus = 'bounced';
        break;
      case 'email.complained':
        newStatus = 'complained';
        break;
      case 'email.delivery_delayed':
        newStatus = 'delayed';
        break;
      default:
        // Ignore other event types (e.g. email.sent, email.opened, email.clicked)
        break;
    }

    if (newStatus) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ email_delivery_status: newStatus })
        .eq('id', orderId);

      if (updateError) {
        console.error(
          `Failed to update order ${orderId} email_delivery_status to ${newStatus}:`,
          updateError
        );
        return NextResponse.json(
          { error: 'Failed to update order email delivery status in database.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true, status: newStatus || 'ignored' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Resend webhook processing error:', message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
