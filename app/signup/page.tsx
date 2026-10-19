'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { useCart } from '@/components/CartContext';
import { getSafeRedirectUrl } from '@/lib/safeRedirect';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const SESSION_STORAGE_KEY_EMAIL = 'studiomaya_signup_pending_email';
const SESSION_STORAGE_KEY_NAME = 'studiomaya_signup_pending_name';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const nextUrl = getSafeRedirectUrl(rawNext, '/account');

  // Form states
  const [step, setStep] = useState<'signup' | 'otp' | 'success'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP states
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Restore saved signup session on client mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const savedEmail = sessionStorage.getItem(SESSION_STORAGE_KEY_EMAIL);
      const savedName = sessionStorage.getItem(SESSION_STORAGE_KEY_NAME);
      if (savedEmail) {
        setEmail(savedEmail);
        setStep('otp');
        setCooldown(30);
      }
      if (savedName) {
        setName(savedName);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Feedback & Loading states
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [existingAccountDetected, setExistingAccountDetected] = useState(false);

  const { syncCartAfterLogin } = useCart();

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus the first input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 50);
    }
  }, [step]);

  // Step 1: Submit initial signup details
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setExistingAccountDetected(false);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Form Validations
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
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

      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
          },
        },
      });

      if (signupError) {
        const msg = signupError.message || '';
        if (
          msg.toLowerCase().includes('already registered') ||
          msg.toLowerCase().includes('already exists')
        ) {
          setExistingAccountDetected(true);
          setError('An account with this email address already exists.');
        } else {
          setError(msg || 'Failed to create account.');
        }
        setLoading(false);
        return;
      }

      // Check if email enumeration prevention returned an existing user (empty identities)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setExistingAccountDetected(true);
        setError('An account with this email address already exists.');
        setLoading(false);
        return;
      }

      // If email confirmation is disabled in Supabase, session is returned immediately
      if (data.session && data.user) {
        document.cookie = `sb-auth-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Lax`;
        setStep('success');
        try {
          await syncCartAfterLogin();
        } catch (syncErr) {
          console.warn('Cart sync post-signup warning:', syncErr);
        }
        window.location.href = nextUrl;
        return;
      }

      // Standard OTP verification flow: Supabase sends a 6-digit code to email
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY_EMAIL, cleanEmail);
        sessionStorage.setItem(SESSION_STORAGE_KEY_NAME, cleanName);
      } catch {
        // sessionStorage unavailable
      }

      setStep('otp');
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setLoading(false);
    }
  };

  // Step 2: Handle 6-digit OTP input changes
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const digitsOnly = value.replace(/\D/g, '');

    if (!digitsOnly) {
      const updated = [...otp];
      updated[index] = '';
      setOtp(updated);
      return;
    }

    // If multiple digits were typed or pasted into a single input
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

    // Single digit entry
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

  // Step 2: Verify 6-digit OTP code with Supabase Auth
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

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: 'signup',
      });

      if (verifyError) {
        const msg = verifyError.message || '';
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

      // Ensure active session is verified before proceeding
      if (!data.session || !data.user) {
        setError('Verification succeeded, but an active session could not be established. Please sign in with your password.');
        setLoading(false);
        return;
      }

      // Cleanup pending OTP storage
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY_EMAIL);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_NAME);
      } catch {
        // Ignore
      }

      setStep('success');

      if (data.session) {
        document.cookie = `sb-auth-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Lax`;
      }

      // Post-verification cart synchronization and guest order linking
      try {
        await syncCartAfterLogin();
      } catch (syncErr) {
        console.warn('Cart sync post-verification warning:', syncErr);
      }

      // Redirect safely to intended destination
      window.location.href = nextUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setLoading(false);
    }
  };

  // Resend code option
  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;

    setError(null);
    setInfoMessage(null);
    setResending(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const cleanEmail = email.trim().toLowerCase();

      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (resendError) {
        const msg = resendError.message || '';
        if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('frequency')) {
          setError('Please wait a moment before requesting another verification code.');
          setCooldown(RESEND_COOLDOWN_SECONDS);
        } else {
          setError(msg || 'Failed to resend verification code. Please try again later.');
        }
        setResending(false);
        return;
      }

      setInfoMessage('A new 6-digit verification code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputsRef.current[0]?.focus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not resend verification code.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  // Change or correct email address
  const handleReturnToSignup = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY_EMAIL);
      sessionStorage.removeItem(SESSION_STORAGE_KEY_NAME);
    } catch {
      // Ignore
    }
    setError(null);
    setInfoMessage(null);
    setExistingAccountDetected(false);
    setStep('signup');
    setOtp(Array(OTP_LENGTH).fill(''));
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
          {step === 'otp' ? 'Verify your email' : step === 'success' ? 'Account verified' : 'Create account'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {step === 'otp'
            ? 'Enter the six-digit code sent to your email address'
            : step === 'success'
            ? 'Redirecting to your account dashboard...'
            : 'Join Studio Maya to manage your workspaces and downloads'}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 leading-relaxed">
            <p>{error}</p>
            {existingAccountDetected && (
              <div className="mt-3 pt-3 border-t border-red-200/70 flex flex-wrap gap-3">
                <Link
                  href={`/login${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
                  className="font-semibold underline text-red-800 hover:text-black transition-colors"
                >
                  Sign in with password
                </Link>
                <Link
                  href="/forgot-password"
                  className="font-semibold underline text-red-800 hover:text-black transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Message */}
      {infoMessage && (
        <div className="mb-6 p-4 bg-blue-50/80 border border-blue-200/60 rounded-2xl flex items-start gap-3 text-blue-800 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
          <div className="flex-1 leading-relaxed">{infoMessage}</div>
        </div>
      )}

      {/* Step: Success Screen */}
      {step === 'success' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Email verified successfully</h3>
          <p className="text-sm text-gray-500">Preparing your Studio Maya workspace...</p>
        </div>
      )}

      {/* Step: OTP Verification Panel */}
      {step === 'otp' && (
        <div>
          {/* Email Chip with change option */}
          <div className="mb-6 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2 truncate mr-2">
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate font-medium text-gray-900">{email}</span>
            </div>
            <button
              type="button"
              onClick={handleReturnToSignup}
              className="text-xs font-semibold text-black hover:underline shrink-0"
            >
              Change
            </button>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-3 text-center">
                Six-digit verification code
              </label>

              {/* 6 Digit Input Grid */}
              <div className="flex justify-between gap-2 sm:gap-2.5">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el;
                    }}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    aria-label={`Verification code digit ${idx + 1}`}
                    disabled={loading}
                    className="w-12 h-14 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-bold font-mono bg-gray-50/60 border border-gray-200 rounded-xl text-gray-950 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white focus:border-black transition-all disabled:opacity-50"
                  />
                ))}
              </div>
            </div>

            {/* Verify Code Button */}
            <button
              type="submit"
              disabled={loading || otp.join('').length !== OTP_LENGTH}
              className="w-full bg-black text-white py-3.5 px-6 rounded-xl font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Verify & Continue</span>
                </>
              )}
            </button>
          </form>

          {/* Resend Code Section with Cooldown */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-gray-500">Didn&apos;t receive the code?</p>
            {cooldown > 0 ? (
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                <span>Resend code in</span>
                <strong className="text-gray-700 font-mono">{cooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending}
                className="text-xs font-semibold text-black hover:underline flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
              onClick={handleReturnToSignup}
              className="mt-3 text-xs text-gray-500 hover:text-black transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to sign up form</span>
            </button>
          </div>
        </div>
      )}

      {/* Step: Initial Signup Form */}
      {step === 'signup' && (
        <>
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
                  <span>Sending verification code...</span>
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
