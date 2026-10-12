'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { useCart } from '@/components/CartContext';
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/account';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { syncCartAfterLogin } = useCart();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Form Validations
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;

      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        },
      });

      if (signupError) {
        setError(signupError.message || 'Failed to create account.');
        setLoading(false);
        return;
      }

      // Check if session was created directly or if verification email was sent
      if (data.session && data.user) {
        try {
          await syncCartAfterLogin();
        } catch (syncErr) {
          console.warn('Cart sync post-signup warning:', syncErr);
        }
        router.push(nextUrl);
        router.refresh();
      } else {
        // Confirmation email required
        setSuccessMessage(
          'Account created successfully! We sent a verification link to your email. Please check your inbox to confirm your account.'
        );
        setLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
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
          Create account
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Join Studio Maya to manage your workspaces and downloads
        </p>
      </div>

      {/* Success Notification */}
      {successMessage ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Check your email</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">{successMessage}</p>
          <Link
            href={`/login${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
            className="inline-block bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      ) : (
        <>
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sai Ganesh"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
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
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Password
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
                Confirm Password
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
                  placeholder="Re-enter your password"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all text-sm"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3.5 px-6 rounded-xl font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link to Sign In */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link
                href={`/login${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
                className="font-semibold text-black hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading sign-up...</div>}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
