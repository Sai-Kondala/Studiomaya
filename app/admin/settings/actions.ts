'use server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export async function updateSettingsAction(formData: FormData) {
  const supabase = createSupabaseAdminClient();
  
  const updates = {
    store_name: formData.get('store_name') as string,
    store_email: formData.get('store_email') as string,
    store_description: formData.get('store_description') as string,
    store_phone: formData.get('store_phone') as string,
    currency: formData.get('currency') as string,
  };

  // Check if settings row exists
  const { data: existing } = await supabase
    .from('admin_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  let error;
  if (existing) {
    const { error: updateError } = await supabase
      .from('admin_settings')
      .update(updates)
      .eq('id', existing.id);
    error = updateError;
  } else {
    const { error: insertError } = await supabase
      .from('admin_settings')
      .insert([updates]);
    error = insertError;
  }

  if (error) {
    throw new Error('Failed to update settings: ' + error.message);
  }

  revalidatePath('/admin/settings');
}
