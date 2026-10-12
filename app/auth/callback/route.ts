import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/account';
  const type = requestUrl.searchParams.get('type');

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
            // Ignored if unable to set from server handler
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If error or no code, redirect to login
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin));
}
