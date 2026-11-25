import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password } = body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid administrator email address.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Verify that the email is on the authorized admin whitelist
    const { data: adminRecord, error: dbError } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (dbError || !adminRecord) {
      return NextResponse.json(
        { error: 'Access Denied: This account is not on the authorized admin whitelist.' },
        { status: 403 }
      );
    }

    // 2. Action: Verify credentials and send 2FA OTP code
    if (action === 'verify-credentials' || !action) {
      if (!password) {
        return NextResponse.json(
          { error: 'Please enter your administrator password.' },
          { status: 400 }
        );
      }

      // Verify password against Supabase Auth
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: authError?.message || 'Invalid administrator credentials.' },
          { status: 401 }
        );
      }

      // Credentials are valid! Now enforce 2FA OTP for EVERY admin login.
      // Even if the password was compromised, the attacker cannot proceed without the email OTP.
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        // Fallback: try resend if user has an unconfirmed otp flow or signInWithOtp rate limit
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        });

        if (resendError) {
          console.error('Admin OTP dispatch error:', otpError, resendError);
          return NextResponse.json(
            { error: 'Failed to dispatch verification code to admin email. Please try again.' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        step: 'otp',
        email: cleanEmail,
        message: 'A six-digit verification code has been sent to your administrator email.',
      });
    }

    // 3. Action: Resend OTP code
    if (action === 'resend-otp') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        return NextResponse.json(
          { error: otpError.message || 'Failed to resend code.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'A new six-digit verification code has been dispatched.',
      });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Admin login API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
