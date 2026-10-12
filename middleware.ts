import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Guard Admin Routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL('/admin/login?error=unconfigured', request.url));
    }

    let userEmail: string | null = null;

    try {
      // 1. Check standard Supabase SSR session cookies
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

      const { data: { user: ssrUser } } = await supabase.auth.getUser();
      if (ssrUser?.email) {
        userEmail = ssrUser.email;
      }

      // 2. Fallback to custom sb-auth-token cookie if SSR cookie was absent
      if (!userEmail) {
        const authCookie = request.cookies.get('sb-auth-token');
        if (authCookie?.value) {
          const supabaseAdmin = createSupabaseAdminClient();
          const { data: { user: tokenUser } } = await supabaseAdmin.auth.getUser(authCookie.value);
          if (tokenUser?.email) {
            userEmail = tokenUser.email;
          }
        }
      }

      if (!userEmail) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }

      // 3. Verify admin whitelist in admin_users table
      const supabaseAdmin = createSupabaseAdminClient();
      const { data: adminUser, error: dbError } = await supabaseAdmin
        .from('admin_users')
        .select('email')
        .eq('email', userEmail.toLowerCase().trim())
        .limit(1)
        .maybeSingle();

      if (dbError || !adminUser) {
        return NextResponse.redirect(new URL('/admin/login?error=not_admin', request.url));
      }

      return response;
    } catch (err: unknown) {
      console.error('Admin Middleware Auth Error:', err);
      return NextResponse.redirect(new URL('/admin/login?error=auth_exception', request.url));
    }
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