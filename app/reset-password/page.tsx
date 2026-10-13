'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Eye, EyeOff, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    const verifySessionAndCode = async () => {
      try {
        // 1. Check if ?code= is present in URL (e.g. redirected directly to this route)
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (mounted) {
              setError(exchangeError.message || 'Invalid or expired password reset link.');
              setCheckingSession(false);
            }
            return;
          }
        }

        // 2. Check for active session
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session) {
            setHasValidSession(true);
          } else {
            const hash = window.location.hash;
            if (!hash.includes('access_token') && !hash.includes('type=recovery')) {
              setError('No active password reset session found. Please request a new reset link.');
            }
          }
          setCheckingSession(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Error verifying reset session.';
          setError(msg);
          setCheckingSession(false);
        }
      }
    };

    // 3. Listen for auth state changes (e.g. PASSWORD_RECOVERY or SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session && mounted) {
          setHasValidSession(true);
          setCheckingSession(false);
        }
      }
    });

    verifySessionAndCode();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        router.push('/account');
      }, 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-100 text-gray-900">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-7 h-7 bg-black rounded-lg transition-transform group-hover:scale-105" />
            <span className="font-bold text-xl tracking-tight text-gray-950">Studio Maya</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-950">
            Set new password
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Choose a strong password to protect your account
          </p>
        </div>

        {checkingSession ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Verifying secure reset link...</p>
          </div>
        ) : success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Password Updated!</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Your password has been changed successfully. Redirecting you to your account...
            </p>
            <Link
              href="/account"
              className="inline-block bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Go to Account
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">
                  <p>{error}</p>
                  {!hasValidSession && (
                    <div className="mt-3">
                      <Link
                        href="/forgot-password"
                        className="inline-flex items-center gap-1.5 font-semibold text-black hover:underline"
                      >
                        Request a new reset link <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasValidSession && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-11 pr-11 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
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

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white py-3.5 px-6 rounded-xl font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <span>Save New Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
