import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to download your files.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const productId = searchParams.get('productId');

    if (!orderId || !productId) {
      return NextResponse.json({ error: 'Order ID and Product ID are required.' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Verify that this order exists, is paid, and belongs to this authenticated user
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, customer_email')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Ownership check: Customer email or user_id must match authenticated user
    const userEmail = user.email?.trim().toLowerCase();
    const orderEmail = order.customer_email?.trim().toLowerCase();

    if (userEmail !== orderEmail) {
      return NextResponse.json({ error: 'You do not have permission to access this order.' }, { status: 403 });
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
      return NextResponse.json({ error: 'Product not found in this order.' }, { status: 404 });
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
        return NextResponse.redirect(product.template_url);
      }
      return NextResponse.json({ error: 'No downloadable file associated with this product.' }, { status: 404 });
    }

    // 4. Generate secure, short-lived 7-day signed URL from private bucket
    const normalizedPath = product.pdf_url.replace(/^\/+/, '');
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('product-files')
      .createSignedUrl(normalizedPath, 60 * 60 * 24 * 7, { download: true });

    if (signError || !signedData?.signedUrl) {
      console.error('Storage signed URL error:', signError?.message);
      return NextResponse.json({ error: 'Failed to generate secure download link.' }, { status: 500 });
    }

    // Redirect to signed download URL
    return NextResponse.redirect(signedData.signedUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Download route error:', message);
    return NextResponse.json({ error: 'An error occurred while generating download link.' }, { status: 500 });
  }
}
