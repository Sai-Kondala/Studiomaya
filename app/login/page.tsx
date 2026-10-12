'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { useCart } from '@/components/CartContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { syncCartAfterLogin } = useCart();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      if (data.user) {
        // Trigger cart sync & customer linking
        try {
          await syncCartAfterLogin();
        } catch (syncErr) {
          console.warn('Cart sync post-login warning:', syncErr);
        }

        // Redirect to intended page or account dashboard
        router.push(nextUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setLoading(false);
    }
  };

  const showGoogleAuth = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
  const showFacebookAuth = process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH === 'true';

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize OAuth sign in.';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-100 text-gray-900">
      {/* StudioMaya Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-7 h-7 bg-black rounded-lg transition-transform group-hover:scale-105" />
          <span className="font-bold text-xl tracking-tight text-gray-950">Studio Maya</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-950">
          Welcome back
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Access your digital purchases and saved cart
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 leading-relaxed">{error}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
            />
            <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="current-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-gray-500 hover:text-black font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="current-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full pl-11 pr-11 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
            />
            <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black accent-black cursor-pointer"
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-3.5 px-6 rounded-xl font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Optional OAuth Buttons (only rendered if configured and functional) */}
        {(showGoogleAuth || showFacebookAuth) && (
          <div className="pt-2">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase tracking-wider">Or</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="space-y-2 mt-2">
              {showGoogleAuth && (
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              )}

              {showFacebookAuth && (
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('facebook')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Continue with Facebook</span>
                </button>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Footer Link to Sign Up */}
      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
            className="font-semibold text-black hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading sign-in...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
