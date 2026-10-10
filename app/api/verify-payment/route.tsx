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
      console.error('Payment verification is not configured: Razorpay secret is missing.');
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
      console.error('Razorpay signature verification failed.');
      return NextResponse.json(
        { error: 'Razorpay signature did not match. Check that the server secret belongs to the same Razorpay key used at checkout.' },
        { status: 400 }
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error('Payment verification is not configured: Supabase server credentials are missing.');
      return NextResponse.json(
        { error: 'Order storage is not configured on the server.' },
        { status: 503 }
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

    const { data: updatedOrder, error: dbError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'paid', 
        razorpay_payment_id: razorpay_payment_id 
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .select('id, customer_email, customer_name')
      .maybeSingle();

    if (dbError) {
      console.error('Supabase payment update error:', JSON.stringify(dbError));
      return NextResponse.json(
        { error: 'The payment was verified, but the order could not be updated. Check the orders table columns and server database credentials.' },
        { status: 500 }
      );
    }

    if (!updatedOrder) {
      console.error('No order row matched the verified Razorpay order ID.');
      return NextResponse.json(
        { error: 'Payment was verified, but no matching order was found. Contact support with your Razorpay order ID.' },
        { status: 404 }
      );
    }

    // Fetch product details from order_items
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('product_id')
      .eq('order_id', updatedOrder.id);

    if (
      itemsError ||
      !orderItems ||
      orderItems.length !== 1 ||
      !orderItems[0]?.product_id
    ) {
      return NextResponse.json(
        { error: 'Order items could not be retrieved.' },
        { status: 500 }
      );
    }

    const { data: product } = await supabaseAdmin
      .from('products')
      .select('name, template_url, pdf_url')
      .eq('id', orderItems[0].product_id)
      .single();

    if (product && updatedOrder.customer_email) {
      const downloadLinks: string[] = [];
      
      if (product.pdf_url) {
        const fileUrl = await createProductDownloadUrl(
          supabaseAdmin,
          product.pdf_url
        );

        if (!fileUrl) {
          return NextResponse.json(
            {
              error: 'Download link generation failed. Please contact support.'
            },
            { status: 500 }
          );
        }

        downloadLinks.push(
          `<li><a href="${fileUrl}" style="color:#2563eb;text-decoration:none;">
            <strong>Download PDF File</strong>
          </a></li>`
        );
      }
      
      if (product.template_url) {
        downloadLinks.push(`<li><a href="${product.template_url}" style="color: #2563eb; text-decoration: none;"><strong>Access Template</strong></a></li>`);
      }

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
          to: updatedOrder.customer_email,
          subject: `Your purchase of ${product.name} is confirmed!`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h1 style="color: #111;">Thank you for your purchase, ${updatedOrder.customer_name}!</h1>
              <p>We have successfully processed your payment for <strong>${product.name}</strong>.</p>
              <p>Here are your files:</p>
              <ul style="line-height: 1.6; padding-left: 20px;">
                ${downloadLinks.join('\\n')}
              </ul>
              <p style="margin-top: 30px; color: #666;">If you have any questions, feel free to reply to this email.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Payment verified, but email failed to send:', emailError);
      }
    }

    return NextResponse.json({ success: true, message: 'Payment verified successfully' }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Payment verification error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Payment verification could not be completed. Check the server logs and required environment variables.' },
      { status: 500 }
    );
  }
}