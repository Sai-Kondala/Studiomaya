import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY!);

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, productId } = await request.json();

    // 1. Verify the signature to ensure nobody is faking a payment
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // 2. Mark order as 'Paid' in Supabase
    await supabase.from('orders')
      .update({ status: 'paid', razorpay_payment_id })
      .eq('razorpay_order_id', razorpay_order_id);

    // 3. Fetch product to get the private PDF file path
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();

    // 4. Generate a secure, temporary download link (valid for 24 hours)
    const { data: fileData } = await supabase.storage
      .from('product-files')
      .createSignedUrl(product.pdf_url, 60 * 60 * 24);

    // 5. Send the email with the secure link
    await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS!,
      to: email,
      subject: `Your Purchase: ${product.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank you for your purchase! 🎉</h2>
          <p>Your payment was successful. Click the button below to download your Notion template files.</p>
          <a href="${fileData?.signedUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Download Product
          </a>
          <p style="color: #666; font-size: 14px;">(This secure link will expire in 24 hours)</p>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}