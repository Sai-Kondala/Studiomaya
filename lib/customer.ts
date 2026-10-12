import { createSupabaseAdminClient } from './supabaseAdmin';

export interface CustomerProfile {
  id?: string;
  user_id?: string;
  email: string;
  full_name: string;
  phone?: string | null;
  created_at?: string;
}

/**
 * Ensures a customer record is linked to the Supabase authenticated user.
 * Avoids duplicate records by linking existing email records or creating a new one.
 */
export async function linkOrCreateCustomer(user: {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
}, phone?: string | null): Promise<CustomerProfile | null> {
  if (!user.email) return null;

  const normalizedEmail = user.email.trim().toLowerCase();
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    normalizedEmail.split('@')[0];

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const customersQuery = supabaseAdmin?.from ? supabaseAdmin.from('customers') : null;
    if (!customersQuery || typeof customersQuery.select !== 'function') {
      return {
        user_id: user.id,
        email: normalizedEmail,
        full_name: fullName,
        phone: phone || null,
      };
    }

    // 1. Check if customer record exists with this user_id
    const { data: existingByUser } = await customersQuery
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingByUser) {
      // Record already linked
      return existingByUser as CustomerProfile;
    }

    // 2. Check if customer record exists with this email (e.g. from previous checkout)
    const { data: existingByEmail } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingByEmail) {
      // Link the existing customer record to this user_id
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('customers')
        .update({
          user_id: user.id,
          full_name: existingByEmail.full_name || fullName,
          phone: phone || existingByEmail.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingByEmail.id)
        .select('*')
        .single();

      if (!updateError && updated) {
        return updated as CustomerProfile;
      }
    }

    // 3. Insert new customer record linked to auth.users
    const { data: created, error: insertError } = await supabaseAdmin
      .from('customers')
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        full_name: fullName,
        phone: phone || null,
      })
      .select('*')
      .single();

    if (!insertError && created) {
      return created as CustomerProfile;
    }

    // Fallback if table does not exist yet
    return {
      user_id: user.id,
      email: normalizedEmail,
      full_name: fullName,
      phone: phone || null,
    };
  } catch (err) {
    console.warn('Customer profile sync warning:', err);
    return {
      user_id: user.id,
      email: normalizedEmail,
      full_name: fullName,
      phone: phone || null,
    };
  }
}
