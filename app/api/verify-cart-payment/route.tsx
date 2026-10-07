import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY);

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
    const { data: updatedOrders, error: dbError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'paid', 
        razorpay_payment_id: razorpay_payment_id 
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .select('customer_email, customer_name, product_id, razorpay_order_id');

    if (dbError) {
      console.error('Supabase payment update error:', JSON.stringify(dbError));
      return NextResponse.json(
        { error: 'The payment was verified, but the orders could not be updated.' },
        { status: 500 }
      );
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      return NextResponse.json(
        { error: 'Payment was verified, but no matching orders were found.' },
        { status: 404 }
      );
    }

    // Fetch product details for all products in the cart
    const productIds = updatedOrders.map(o => o.product_id);
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, template_url, pdf_url')
      .in('id', productIds);

    if (products && products.length > 0 && updatedOrders[0].customer_email) {
      const downloadLinks: string[] = [];
      
      products.forEach(product => {
        downloadLinks.push(`<h3 style="margin-bottom: 5px;">${product.name}</h3>`);
        if (product.pdf_url) {
          const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-files/${product.pdf_url}`;
          downloadLinks.push(`<li><a href="${fileUrl}" style="color: #2563eb; text-decoration: none;"><strong>Download PDF File</strong></a></li>`);
        }
        if (product.template_url) {
          downloadLinks.push(`<li><a href="${product.template_url}" style="color: #2563eb; text-decoration: none;"><strong>Access Template</strong></a></li>`);
        }
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
        to: updatedOrders[0].customer_email,
        subject: `Your purchase from Studio Maya is confirmed!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h1 style="color: #111;">Thank you for your purchase, ${updatedOrders[0].customer_name}!</h1>
            <p>We have successfully processed your payment for your digital products.</p>
            <p>Here are your files:</p>
            <ul style="line-height: 1.6; padding-left: 20px;">
              ${downloadLinks.join('\\n')}
            </ul>
            <p style="margin-top: 30px; color: #666;">If you have any questions, feel free to reply to this email.</p>
          </div>
        `,
      });
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
