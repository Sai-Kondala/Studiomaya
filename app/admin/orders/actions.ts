'use server';

import { verifyAdminSession } from '@/lib/adminAuth';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';
import { revalidatePath } from 'next/cache';

export async function resendOrderReceiptAction(orderId: string) {
  await verifyAdminSession();

  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid order ID.');
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const result = await sendOrderReceiptEmail(orderId, supabaseAdmin, { force: true });

  revalidatePath('/admin/orders');

  if (!result.success) {
    throw new Error(result.error || 'Failed to resend order receipt email.');
  }

  return { success: true, message: result.message };
}
