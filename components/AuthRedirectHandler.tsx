'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

/**
 * Listens for recovery events and catches edge-case auth redirects
 * (e.g. when Supabase falls back to the Site URL root with #type=recovery or ?code=).
 */
export function AuthRedirectHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. If currently on root '/' or another non-auth path, check URL hash and search params
    const hash = window.location.hash;
    const search = window.location.search;

    if (pathname === '/') {
      // Recovery token hash fallback from Supabase Site URL
      if (hash && (hash.includes('type=recovery') || hash.includes('type%3Drecovery'))) {
        window.location.replace('/reset-password' + hash);
        return;
      }

      // Authorization code fallback from Supabase Site URL
      if (search) {
        const params = new URLSearchParams(search);
        const code = params.get('code');
        if (code) {
          const type = params.get('type');
          const next = type === 'recovery' ? '/reset-password' : (params.get('next') || '/reset-password');
          window.location.replace(
            `/auth/callback?code=${encodeURIComponent(code)}&type=${type || 'recovery'}&next=${encodeURIComponent(next)}`
          );
          return;
        }
      }
    }

    // 2. Global listener for PASSWORD_RECOVERY events
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
        if (event === 'PASSWORD_RECOVERY' && pathname !== '/reset-password') {
          router.push('/reset-password');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // Ignore if Supabase client not initialized yet
    }
  }, [pathname, router]);

  return null;
}
