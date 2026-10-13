import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSafeRedirectUrl } from '@/lib/safeRedirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const rawNext = requestUrl.searchParams.get('next');
  const safeNext = getSafeRedirectUrl(rawNext, '/account');
  const type = requestUrl.searchParams.get('type');

  if (code || token_hash) {
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

    if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({
        type: (type as EmailOtpType) || 'recovery',
        token_hash,
      });

      if (!error) {
        if (type === 'recovery' || safeNext === '/reset-password') {
          return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
        }
        return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
      }
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (type === 'recovery' || safeNext === '/reset-password') {
          return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
        }
        return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
      }
    }
  }

  // If error or neither code nor token_hash, redirect to login
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin));
}

