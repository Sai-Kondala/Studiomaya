import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Guard Admin Routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const authCookie = request.cookies.get('sb-auth-token');

    if (!authCookie || !authCookie.value) {
      // No active session found, redirect back to admin login
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      const supabaseAdmin = createSupabaseAdminClient();

      // Verify token with Supabase auth
      const {
        data: { user },
        error: authError,
      } = await supabaseAdmin.auth.getUser(authCookie.value);

      if (authError || !user || !user.email) {
        return NextResponse.redirect(
          new URL(
            '/admin/login?error=authError_' +
              (authError?.message || 'nouser'),
            request.url
          )
        );
      }

      // Check admin whitelist table
      const { data: adminUser, error: dbError } = await supabaseAdmin
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .limit(1)
        .maybeSingle();

      if (dbError || !adminUser) {
        // Authenticated user is not an admin
        return NextResponse.redirect(
          new URL(
            '/admin/login?error=notAdmin_' +
              (dbError?.message || 'nomatch'),
            request.url
          )
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'unknown';
      console.error('Admin Middleware Auth Error:', err);
      return NextResponse.redirect(
        new URL('/admin/login?error=exception_' + errorMessage, request.url)
      );
    }

    return NextResponse.next();
  }

  // 2. Guard Authenticated Customer Routes (/account/*)
  if (pathname.startsWith('/account')) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Validate the token cryptographically on Supabase Auth server
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Run on both admin routes and protected customer account routes
  matcher: ['/admin/:path*', '/account/:path*'],
};