import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function middleware(request: NextRequest) {
  // Check if user is accessing an admin route (but let them see the login page)
  if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
     
     const authCookie = request.cookies.get('sb-auth-token');
     
     if (!authCookie || !authCookie.value) {
        // No active session found, redirect back to login
        return NextResponse.redirect(new URL('/admin/login', request.url));
     }

     try {
       const supabaseAdmin = createSupabaseAdminClient();
       
       // 1. Verify the token with Supabase auth
       const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authCookie.value);

       if (authError || !user || !user.email) {
         return NextResponse.redirect(new URL('/admin/login?error=authError_' + (authError?.message || 'nouser'), request.url));
       }

       const { data: adminUser, error: dbError } = await supabaseAdmin
         .from('admin_users')
         .select('email')
         .eq('email', user.email)
         .limit(1)
         .maybeSingle();

       if (dbError || !adminUser) {
         // Logged in but not an admin
         return NextResponse.redirect(new URL('/admin/login?error=notAdmin_' + (dbError?.message || 'nomatch'), request.url));
       }
     } catch (err: any) {
       console.error("Middleware Auth Error:", err);
       return NextResponse.redirect(new URL('/admin/login?error=exception_' + (err?.message || 'unknown'), request.url));
     }
  }
  
  return NextResponse.next();
}

export const config = {
  // This tells Next.js to only run this middleware on /admin routes
  matcher: ['/admin/:path*'],
};