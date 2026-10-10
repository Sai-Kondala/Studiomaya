import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY);

async function createProductDownloadUrl(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  pdfPath: string
) {
  const normalizedPath = pdfPath.replace(/^\/+/, '');

  const { data, error } = await supabaseAdmin.storage
    .from('product-files')
    .createSignedUrl(
      normalizedPath,
      60 * 60 * 24 * 7,
      { download: true }
    );

  if (error || !data?.signedUrl) {
    console.error('Failed to create download link:', error?.message);
    return null;
  }

  return data.signedUrl;
}

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
    if (!secret) {
      return NextResponse.json(
        { error: 'Payment verification is not configured on the server.' },
        { status: 503 }
      );
    }

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

    // Check if order is already paid to prevent duplicate emails
    const { data: existingOrder, error: checkError } = await supabaseAdmin
      .from('orders')
      .select('id, status, customer_email, customer_name')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Supabase status check error:', JSON.stringify(checkError));
      return NextResponse.json(
        { error: 'Could not verify existing order status.' },
        { status: 500 }
      );
    }

    if (existingOrder && existingOrder.status === 'paid') {
      return NextResponse.json({ success: true, message: 'Payment already verified' }, { status: 200 });
    }

    // Update the canonical order
    const { data: updatedOrder, error: dbError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        razorpay_payment_id: razorpay_payment_id
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .select('id, customer_email, customer_name')
      .single();

    if (dbError) {
      console.error('Supabase payment update error:', JSON.stringify(dbError));
      return NextResponse.json(
        { error: 'The payment was verified, but the order could not be updated.' },
        { status: 500 }
      );
    }

    if (!updatedOrder) {
      return NextResponse.json(
        { error: 'Payment was verified, but no matching order was found.' },
        { status: 404 }
      );
    }

    // Fetch order items to deliver products
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('product_id')
      .eq('order_id', updatedOrder.id);

    if (itemsError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: 'Payment verified, but order items could not be retrieved.' },
        { status: 500 }
      );
    }

    const productIds = orderItems.map(item => item.product_id);
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, template_url, pdf_url')
      .in('id', productIds);

    if (products && products.length > 0 && updatedOrder.customer_email) {
      const downloadLinks: string[] = [];

      for (const product of products) {
        downloadLinks.push(`<div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 20px; text-align: center;">`);
        downloadLinks.push(`<h3 style="margin-top: 0; margin-bottom: 15px; color: #111111; font-size: 18px;">${product.name}</h3>`);
        
        if (product.pdf_url) {
          const fileUrl = await createProductDownloadUrl(
            supabaseAdmin,
            product.pdf_url
          );

          if (!fileUrl) {
            return NextResponse.json(
              {
                error: `Download link generation failed for ${product.name}.`
              },
              { status: 500 }
            );
          }

          downloadLinks.push(
            `<div style="margin-bottom: 10px;">
              <a href="${fileUrl}" style="display: inline-block; padding: 10px 20px; background-color: #000000; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 15px;">
                Download PDF File
              </a>
            </div>`
          );
        }
        if (product.template_url) {
          downloadLinks.push(
            `<div style="margin-bottom: 10px;">
              <a href="${product.template_url}" style="display: inline-block; padding: 10px 20px; background-color: #000000; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 15px;">
                Access Template
              </a>
            </div>`
          );
        }
        downloadLinks.push(`</div>`);
      }

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
          to: updatedOrder.customer_email,
          subject: `Your purchase from Studio Maya is confirmed!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #333333; border: 1px solid #eaeaea; border-radius: 8px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #111111; font-size: 24px; margin-bottom: 10px;">Thank you for your purchase! 🎉</h1>
                <p style="font-size: 16px; color: #555555; line-height: 1.5; margin: 0;">
                  Your payment was successful. Click the buttons below to access your digital products.
                </p>
              </div>
              
              <div style="margin-bottom: 30px;">
                ${downloadLinks.join('')}
              </div>

              <div style="text-align: center; font-size: 14px; color: #888888; border-top: 1px solid #eaeaea; padding-top: 20px;">
                <p>(These secure links will expire in 7 days)</p>
                <p style="margin-top: 10px;">If you have any questions, feel free to reply to this email.</p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Payment verified, but email failed to send:', emailError);
        // We do not throw the error here so that the payment process completes successfully.
      }
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
