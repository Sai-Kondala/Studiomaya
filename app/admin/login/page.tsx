'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import {
  Shield,
  AlertCircle,
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const SESSION_STORAGE_KEY_ADMIN_EMAIL = 'studiomaya_admin_pending_email';

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const urlErrorParam = searchParams.get('error');

  const getUrlErrorMessage = (param: string | null) => {
    if (!param) return null;
    switch (param) {
      case 'not_admin':
        return 'Access Denied: This account is not on the authorized admin whitelist.';
      case 'unconfigured':
        return 'Server error: Admin credentials are not configured.';
      case 'auth_exception':
        return 'Session expired or authentication failed. Please sign in again.';
      default:
        return 'Access restricted to authorized administrators.';
    }
  };

  // Form states: credentials -> otp -> success
  const [step, setStep] = useState<'credentials' | 'otp' | 'success'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP states
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Feedback states
  const [error, setError] = useState<string | null>(getUrlErrorMessage(urlErrorParam));
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Restore saved admin email on client mount if available
  useEffect(() => {
    try {
      const savedEmail = sessionStorage.getItem(SESSION_STORAGE_KEY_ADMIN_EMAIL);
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP input when transitioning to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 60);
    }
  }, [step]);

  // Step 1: Submit credentials (Email + Password)
  // Verifies password, but DOES NOT log in yet: dispatches 6-digit OTP to admin email
  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid administrator email address.');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter your administrator password.');
      setLoading(false);
      return;
    }

    try {
      // Call server API to verify admin whitelist and password, then dispatch OTP
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-credentials',
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to authenticate administrator credentials.');
        setLoading(false);
        return;
      }

      // Save pending email in sessionStorage
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY_ADMIN_EMAIL, cleanEmail);
      } catch {
        // Ignore
      }

      setStep('otp');
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfoMessage(
        data.message || 'A six-digit verification code has been dispatched to your email.'
      );
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  // Step 2: Handle OTP input changes
  const handleDigitChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');

    if (!digitsOnly) {
      const updated = [...otp];
      updated[index] = '';
      setOtp(updated);
      return;
    }

    if (digitsOnly.length > 1) {
      const updated = [...otp];
      const chars = digitsOnly.slice(0, OTP_LENGTH).split('');
      for (let i = 0; i < chars.length && index + i < OTP_LENGTH; i++) {
        updated[index + i] = chars[i];
      }
      setOtp(updated);
      const nextFocus = Math.min(index + chars.length, OTP_LENGTH - 1);
      otpInputsRef.current[nextFocus]?.focus();
      return;
    }

    const updated = [...otp];
    updated[index] = digitsOnly;
    setOtp(updated);

    if (index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const updated = [...otp];
        updated[index] = '';
        setOtp(updated);
      } else if (index > 0) {
        const updated = [...otp];
        updated[index - 1] = '';
        setOtp(updated);
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    const digits = pastedData.replace(/\D/g, '').slice(0, OTP_LENGTH);

    if (digits.length > 0) {
      const updated = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < digits.length; i++) {
        updated[i] = digits[i];
      }
      setOtp(updated);
      const targetFocus = Math.min(digits.length, OTP_LENGTH - 1);
      otpInputsRef.current[targetFocus]?.focus();
    }
  };

  // Step 2: Verify 6-digit OTP code and authorize admin session
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const token = otp.join('').trim();

    if (token.length !== OTP_LENGTH || !/^\d{6}$/.test(token)) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const cleanEmail = email.trim().toLowerCase();

      // Attempt verification with type 'email' (from signInWithOtp)
      let { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: 'email',
      });

      // Fallback: If code was sent with type 'signup', verify with signup type
      if (verifyError) {
        const fallbackRes = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: 'signup',
        });
        if (!fallbackRes.error && fallbackRes.data?.session) {
          data = fallbackRes.data;
          verifyError = null;
        }
      }

      if (verifyError || !data?.session) {
        const msg = verifyError?.message || '';
        if (msg.toLowerCase().includes('expired')) {
          setError('This verification code has expired. Please request a new code.');
        } else if (msg.toLowerCase().includes('invalid')) {
          setError('Invalid verification code. Please check your email and try again.');
        } else {
          setError(msg || 'Verification failed. Please check the code and try again.');
        }
        setLoading(false);
        return;
      }

      // Cleanup pending email storage
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY_ADMIN_EMAIL);
      } catch {
        // Ignore
      }

      setStep('success');

      // Save token to cookie for Edge middleware validation
      document.cookie = `sb-auth-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Lax`;

      // Redirect directly to admin dashboard
      window.location.href = '/admin/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;

    setError(null);
    setInfoMessage(null);
    setResending(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resend-otp',
          email: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to resend verification code.');
        setResending(false);
        return;
      }

      setInfoMessage('A new 6-digit verification code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputsRef.current[0]?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend verification code.');
    } finally {
      setResending(false);
    }
  };

  const handleReturnToCredentials = () => {
    setError(null);
    setInfoMessage(null);
    setStep('credentials');
    setOtp(Array(OTP_LENGTH).fill(''));
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl border border-gray-100 text-[#242424]">
      {/* Admin Portal Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#F2EEFA] text-[#5D4396] flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#242424]">
          {step === 'otp' ? 'Verify Admin Identity' : step === 'success' ? 'Authorized' : 'Admin Portal'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {step === 'otp'
            ? 'Enter the 6-digit verification code sent to your email'
            : step === 'success'
            ? 'Redirecting to admin dashboard...'
            : 'Authorized Studio Maya administrators only'}
        </p>
      </div>

      {/* Error Message Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Info Message Alert */}
      {infoMessage && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{infoMessage}</span>
        </div>
      )}

      {/* Step: Success Screen */}
      {step === 'success' && (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-gray-800">Authorization Verified</p>
          <p className="text-xs text-gray-500 mt-1">Opening Studio Maya Management Dashboard...</p>
        </div>
      )}

      {/* Step 1: Credentials Form */}
      {step === 'credentials' && (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@studiomaya.store"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3.5 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all bg-[#FAF8F5]/50"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3.5 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all bg-[#FAF8F5]/50"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#242424] py-3 text-sm font-semibold text-white hover:bg-black transition-colors disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <span>Continue to Verification</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Step 2: 6-Digit OTP Verification Screen (identical to signup) */}
      {step === 'otp' && (
        <div>
          {/* Email badge with change option */}
          <div className="mb-5 p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2 truncate mr-2">
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate font-medium text-gray-900">{email}</span>
            </div>
            <button
              type="button"
              onClick={handleReturnToCredentials}
              className="text-xs font-semibold text-black hover:underline shrink-0 cursor-pointer"
            >
              Change
            </button>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2.5 text-center">
                Six-digit verification code
              </label>

              {/* 6 Digit Input Grid */}
              <div className="flex justify-between gap-1.5 sm:gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el;
                    }}
                    id={`admin-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    aria-label={`Digit ${idx + 1}`}
                    disabled={loading}
                    className="w-11 h-12 text-center text-xl font-bold font-mono bg-gray-50/60 border border-gray-200 rounded-xl text-gray-950 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white focus:border-black transition-all disabled:opacity-50"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length !== OTP_LENGTH}
              className="w-full bg-[#242424] text-white py-3 px-4 rounded-xl font-medium hover:bg-black transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authorizing...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Verify &amp; Authorize Admin</span>
                </>
              )}
            </button>
          </form>

          {/* Resend Cooldown Section */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-xs text-gray-500">Didn&apos;t receive the code?</p>
            {cooldown > 0 ? (
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                <span>Resend in</span>
                <strong className="text-gray-700 font-mono">{cooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="text-xs font-semibold text-black hover:underline flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend verification code</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleReturnToCredentials}
              className="mt-2 text-xs text-gray-500 hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to credentials</span>
            </button>
          </div>
        </div>
      )}

      {/* Return to storefront link */}
      <div className="mt-6 pt-4 border-t border-gray-100 text-center">
        <Link href="/" className="text-xs text-gray-400 hover:text-black transition-colors">
          ← Return to Storefront
        </Link>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-[#F8F7F4] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading admin portal...</div>}>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}