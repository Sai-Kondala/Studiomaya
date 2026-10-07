import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if user is accessing an admin route (but let them see the login page)
  if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
     
     // Supabase stores a session cookie when logged in. We check if any auth cookie exists.
     const hasAuthCookie = request.cookies.getAll().some(cookie => cookie.name.includes('-auth-token'));
     
     if (!hasAuthCookie) {
        // No active session found, redirect back to login
        return NextResponse.redirect(new URL('/admin/login', request.url));
     }
  }
  
  return NextResponse.next();
}

export const config = {
  // This tells Next.js to only run this middleware on /admin routes
  matcher: ['/admin/:path*'],
};