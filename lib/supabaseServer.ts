import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase client credentials are not configured.');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where setting cookies is restricted.
          // Ignored if middleware or route handler manages refresh.
        }
      },
    },
  });
}

/**
 * Returns the currently authenticated user from server session cookies,
 * validating the token cryptographically with Supabase Auth, with fallback
 * to sb-auth-token cookie.
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user && !error) {
      return user;
    }

    // Fallback: Check sb-auth-token cookie if SSR cookie was absent or in refresh transition
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('sb-auth-token');
    if (authCookie?.value) {
      const { createSupabaseAdminClient } = await import('@/lib/supabaseAdmin');
      const supabaseAdmin = createSupabaseAdminClient();
      const { data: { user: tokenUser } } = await supabaseAdmin.auth.getUser(authCookie.value);
      if (tokenUser) {
        return tokenUser;
      }
    }

    return null;
  } catch {
    return null;
  }
}
