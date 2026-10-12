import { createSupabaseServerClient } from './supabaseServer';
import { createSupabaseAdminClient } from './supabaseAdmin';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

export interface AdminSession {
  user: User;
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
}

/**
 * Validates the caller's identity via standard Supabase SSR session or fallback token,
 * and confirms that the user is an active member in the admin_users whitelist table.
 * Throws an Error('Unauthorized') if the caller is not an authorized administrator.
 */
export async function verifyAdminSession(): Promise<AdminSession> {
  const supabaseAdmin = createSupabaseAdminClient();
  let user: User | null = null;

  // 1. Primary: Validate cryptographically via standard Supabase SSR session
  try {
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user: ssrUser }, error: ssrError } = await supabaseServer.auth.getUser();
    if (!ssrError && ssrUser) {
      user = ssrUser;
    }
  } catch {
    // Continue to fallback check
  }

  // 2. Secondary fallback: Check sb-auth-token cookie if SSR session cookie was not found
  if (!user) {
    try {
      const cookieStore = await cookies();
      const authCookie = cookieStore.get('sb-auth-token');
      if (authCookie?.value) {
        const { data: { user: tokenUser }, error: tokenError } = await supabaseAdmin.auth.getUser(authCookie.value);
        if (!tokenError && tokenUser) {
          user = tokenUser;
        }
      }
    } catch {
      // Fallback failed
    }
  }

  if (!user || !user.email) {
    throw new Error('Unauthorized: Authentication required.');
  }

  // 3. Verify user against admin_users whitelist table
  const { data: adminRecord, error: dbError } = await supabaseAdmin
    .from('admin_users')
    .select('email')
    .eq('email', user.email.toLowerCase().trim())
    .limit(1)
    .maybeSingle();

  if (dbError || !adminRecord) {
    throw new Error('Unauthorized: Admin privileges required.');
  }

  return { user, supabaseAdmin };
}
