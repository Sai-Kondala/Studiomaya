'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Shield, AlertCircle } from 'lucide-react';

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(getUrlErrorMessage(urlErrorParam));
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid admin credentials.');
        setLoading(false);
      } else if (data.session) {
        // Save the Supabase token as a cookie so the Next.js middleware can read it
        document.cookie = `sb-auth-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Lax`;
        
        // Use a hard redirect to force the server to evaluate the new cookie
        window.location.href = '/admin/dashboard';
      } else {
        setError('Please check your email to verify your account before logging in.');
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl border border-gray-100 text-[#242424]">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#F2EEFA] text-[#5D4396] flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#242424]">Admin Portal</h1>
        <p className="text-xs text-gray-500 mt-1">Authorized Studio Maya administrators only</p>
      </div>
      
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
            Admin Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@studiomaya.store"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all bg-[#FAF8F5]/50"
          />
        </div>
        
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all bg-[#FAF8F5]/50"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#242424] py-3 text-sm font-semibold text-white hover:bg-black transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? 'Authenticating...' : 'Sign In to Admin'}
        </button>
      </form>

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