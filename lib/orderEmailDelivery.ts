import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { generateThermalReceiptEmailHtml, EmailDownloadLink, EmailReceiptItem } from '@/lib/emailReceiptTemplate';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';

export async function createProductDownloadUrl(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  pdfPath: string
): Promise<string | null> {
  if (!pdfPath || typeof pdfPath !== 'string') {
    return null;
  }

  const normalizedPath = pdfPath.trim().replace(/^\/+/, '');

  // Guard against path traversal and null bytes
  if (normalizedPath.includes('..') || normalizedPath.includes('\0')) {
    logger.error('Invalid or suspicious storage path for download URL', null, { pdfPath });
    return null;
  }

  // Generate 24-hour temporary signed download link for email delivery
  const { data, error } = await supabaseAdmin.storage
    .from('product-files')
    .createSignedUrl(
      normalizedPath,
      60 * 60 * 24,
      { download: true }
    );

  if (error || !data?.signedUrl) {
    logger.error('Failed to create download link from storage', error);
    return null;
  }

  return data.signedUrl;
}

export interface SendReceiptResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface SendReceiptOptions {
  force?: boolean;
}

export async function sendOrderReceiptEmail(
  orderId: string,
  client?: ReturnType<typeof createSupabaseAdminClient>,
  options?: SendReceiptOptions
): Promise<SendReceiptResult> {
  const supabaseAdmin = client || createSupabaseAdminClient();
  const resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY);

  // 1. Fetch order details
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, amount, customer_name, customer_email, email_delivery_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Order not found for email delivery.' };
  }

  if (!order.customer_email) {
    return { success: false, error: 'Order has no customer email address.' };
  }

  // Idempotency check: if already sent or delivered, don't duplicate unless explicitly forced
  if (!options?.force && (order.email_delivery_status === 'sent' || order.email_delivery_status === 'delivered')) {
    return {
      success: true,
      message: `Receipt email already ${order.email_delivery_status}.`,
    };
  }

  // 2. Fetch order items
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('product_id, product_name_snapshot, unit_price')
    .eq('order_id', order.id);

  if (itemsError || !orderItems || orderItems.length === 0) {
    return { success: false, error: 'Order items not found for email delivery.' };
  }

  // 3. Fetch products
  const productIds = orderItems.map((item: any) => item.product_id).filter(Boolean);
  let products: any[] = [];
  if (productIds.length > 0) {
    const query = supabaseAdmin
      .from('products')
      .select('id, name, price, template_url, pdf_url');

    if (typeof (query as any).in === 'function') {
      const { data } = await query.in('id', productIds);
      products = data || [];
    } else if (typeof (query as any).eq === 'function') {
      const { data } = await (query as any).eq('id', productIds[0]).single();
      products = data ? [{ ...data, id: productIds[0] }] : [];
    }
  }

  const productMap = new Map(products.map((p: any) => [p.id, p]));

  // 4. Generate download links
  const downloadLinks: EmailDownloadLink[] = [];
  for (const item of orderItems) {
    const prod = productMap.get(item.product_id) || (products.length === 1 ? products[0] : undefined);
    if (!prod) continue;

    if (prod.pdf_url) {
      const fileUrl = await createProductDownloadUrl(supabaseAdmin, prod.pdf_url);
      if (fileUrl) {
        downloadLinks.push({
          productName: prod.name,
          url: fileUrl,
          type: 'pdf',
        });
      }
    }

    if (prod.template_url) {
      downloadLinks.push({
        productName: prod.name,
        url: prod.template_url,
        type: 'template',
      });
    }
  }

  // 5. Build receipt items
  const receiptItems: EmailReceiptItem[] = orderItems.map((item: any) => {
    const prod = productMap.get(item.product_id) || (products.length === 1 ? products[0] : undefined);
    return {
      name: item.product_name_snapshot || prod?.name || 'Digital Product',
      price: Number(item.unit_price) || prod?.price || 0,
    };
  });

  const shortId = order.id ? order.id.split('-')[0].toUpperCase() : 'ORD';
  const orderAmt = Number(order.amount) || receiptItems.reduce((acc, i) => acc + i.price, 0);

  const emailHtml = generateThermalReceiptEmailHtml({
    orderNumber: `ORD-${shortId}`,
    customerName: order.customer_name || 'Valued Creator',
    customerEmail: order.customer_email,
    items: receiptItems,
    totalAmount: orderAmt,
    downloadLinks,
  });

  // 6. Send email via Resend and inspect returned error
  try {
    const resendResponse = await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
      to: order.customer_email,
      subject: `Your receipt from Studio Maya — ORD-${shortId}`,
      html: emailHtml,
      tags: [
        { name: 'order_id', value: order.id },
      ],
    });

    const resendError = (resendResponse as any)?.error;
    const hasData = Boolean((resendResponse as any)?.data || (resendResponse as any)?.id);
    const hasError = Boolean(resendError);

    if (hasError || !hasData) {
      const errorMsg =
        resendError?.message ||
        (typeof resendError === 'string' ? resendError : 'Resend API returned failure without delivery data');
      logger.error('Email delivery error reported by Resend API', null, { error: errorMsg, orderId: order.id });

      try {
        await supabaseAdmin
          .from('orders')
          .update({ email_delivery_status: 'failed' })
          .eq('id', order.id);
      } catch {
        // Non-fatal if column pending migration
      }

      return { success: false, error: errorMsg };
    }

    // Update status to 'sent' (delivery will be confirmed via Resend webhook)
    try {
      await supabaseAdmin
        .from('orders')
        .update({ email_delivery_status: 'sent' })
        .eq('id', order.id);
    } catch {
      // Non-fatal if column pending migration
    }

    return { success: true, message: 'Receipt email dispatched successfully.' };
  } catch (emailError: unknown) {
    const msg = emailError instanceof Error ? emailError.message : String(emailError);
    logger.error('Email delivery exception', emailError, { orderId: order.id });

    // Update status to failed
    try {
      await supabaseAdmin
        .from('orders')
        .update({ email_delivery_status: 'failed' })
        .eq('id', order.id);
    } catch {
      // Non-fatal if column pending migration
    }

    return { success: false, error: msg };
  }
}
