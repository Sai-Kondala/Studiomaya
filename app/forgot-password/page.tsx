'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/auth/callback?type=recovery&next=/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || 'Failed to send password recovery email.');
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-100 text-gray-900">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-7 h-7 bg-black rounded-lg transition-transform group-hover:scale-105" />
            <span className="font-bold text-xl tracking-tight text-gray-950">Studio Maya</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-950">
            Reset password
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            We will send a secure link to your email to reset your password
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Check your email</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              If an account exists with <strong className="text-gray-900">{email}</strong>, you will receive a password reset link shortly.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full bg-black text-white py-3.5 px-6 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  Account Email
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white py-3.5 px-6 rounded-xl font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to sign in</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
