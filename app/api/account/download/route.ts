import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { checkRateLimitDistributed, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

/**
 * Validates external template destination URLs to protect customers
 * against open redirects or compromised destination domains.
 */
function isValidTemplateRedirect(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    const allowedExactHostnames = [
      'notion.so',
      'www.notion.so',
      'notion.site',
      'studiomaya.com',
      'www.studiomaya.com',
    ];

    if (
      allowedExactHostnames.includes(hostname) ||
      hostname.endsWith('.notion.site') ||
      hostname.endsWith('.notion.so')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

import { verifyGuestDownloadToken } from '@/lib/downloadAuth';

export async function GET(request: Request) {
  try {
    if (process.env.NODE_ENV !== 'test') {
      const clientIp = getClientIp(request);
      const rateLimit = await checkRateLimitDistributed(`download_${clientIp}`, { limit: 40, windowMs: 60_000 });
      if (!rateLimit.allowed) {
        logger.warn('Rate limit exceeded on download link generation', { ip: clientIp });
        return rateLimitResponse(rateLimit.resetMs);
      }
    }

    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const productId = searchParams.get('productId');
    const token = searchParams.get('token');

    if (!orderId || !productId) {
      return NextResponse.json({ error: 'Order ID and Product ID are required.' }, { status: 400 });
    }

    // Require authenticated session or valid guest download access token
    if (!user && !token) {
      return NextResponse.json({ error: 'Please sign in to download your files.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Verify that this order exists, is paid, and belongs to this customer
    let { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, customer_email, user_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError && (orderError.code === '42703' || orderError.code === 'PGRST204' || (typeof orderError.message === 'string' && orderError.message.includes('user_id')))) {
      const fallback = await supabaseAdmin
        .from('orders')
        .select('id, status, customer_email')
        .eq('id', orderId)
        .maybeSingle();
      order = fallback.data as any;
      orderError = fallback.error;
    }

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const orderUserId = (order as any).user_id;
    const orderEmail = order.customer_email?.trim().toLowerCase();

    // Strict ownership verification:
    // Case A: Account purchase (user_id is set). Requires authenticated session matching that exact user.
    if (orderUserId) {
      if (!user) {
        return NextResponse.json({ error: 'Please sign in to access purchases linked to your account.' }, { status: 401 });
      }
      if (orderUserId !== user.id) {
        return NextResponse.json({ error: 'You do not have permission to access this order.' }, { status: 403 });
      }
    } else {
      // Case B: Unassigned guest purchase (user_id is null).
      // Permitted if signed into verified account with matching email, OR possessing a valid cryptographic guest token.
      let isAuthorizedGuest = false;
      if (user?.email && orderEmail && user.email.trim().toLowerCase() === orderEmail) {
        isAuthorizedGuest = true;
      } else if (token && orderEmail && verifyGuestDownloadToken(token, order.id, productId, orderEmail)) {
        isAuthorizedGuest = true;
      }

      if (!isAuthorizedGuest) {
        return NextResponse.json({ error: 'You do not have permission to access this order.' }, { status: 403 });
      }
    }

    if (order.status !== 'paid') {
      return NextResponse.json({ error: 'Downloads are only available for confirmed, paid purchases.' }, { status: 403 });
    }

    // 2. Verify that this product was part of the order
    const { data: orderItem, error: itemError } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', order.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (itemError || !orderItem) {
      logger.warn('Unauthorized product download attempt across mismatched orderId/productId', {
        orderId,
        productId,
        userId: user?.id ?? 'guest',
      });
      return NextResponse.json(
        { error: 'This product was not purchased in the specified order.' },
        { status: 403 }
      );
    }

    // 3. Fetch product details
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('name, pdf_url, template_url')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (!product.pdf_url) {
      if (product.template_url) {
        if (!isValidTemplateRedirect(product.template_url)) {
          logger.error(`Blocked untrusted template redirect URL: ${product.template_url}`);
          return NextResponse.json({ error: 'Product template URL destination is untrusted or invalid.' }, { status: 400 });
        }
        return NextResponse.redirect(product.template_url);
      }
      return NextResponse.json({ error: 'No downloadable file associated with this product.' }, { status: 404 });
    }

    // 4. Generate secure, short-lived 15-minute signed URL from private bucket
    const normalizedPath = product.pdf_url.trim().replace(/^\/+/, '');
    if (normalizedPath.includes('..') || normalizedPath.includes('\0')) {
      logger.error('Invalid storage file path in product record', null, { productId, path: product.pdf_url });
      return NextResponse.json({ error: 'Invalid product file configuration.' }, { status: 400 });
    }

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('product-files')
      .createSignedUrl(normalizedPath, 60 * 15, { download: true });

    if (signError || !signedData?.signedUrl) {
      logger.error('Storage signed URL error', signError);
      return NextResponse.json({ error: 'Failed to generate secure download link.' }, { status: 500 });
    }

    // Redirect to signed download URL
    return NextResponse.redirect(signedData.signedUrl);
  } catch (error: unknown) {
    logger.error('Download route error', error);
    return NextResponse.json({ error: 'An error occurred while generating download link.' }, { status: 500 });
  }
}
