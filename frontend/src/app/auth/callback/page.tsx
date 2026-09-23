'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

/**
 * OAuth callback handler.
 *
 * Supabase (detectSessionInUrl) consumes the ?code=... PKCE parameter on
 * mount. We verify the resulting session server-side (getUser) instead of
 * trusting client session state, then route accordingly. Errors and cancellations
 * land back on /login with a visible message (gitoauthrules Rule 5.1).
 */
export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Authenticating with GitHub…');

  useEffect(() => {
    let cancelled = false;

    const handleAuth = async () => {
      if (!isSupabaseConfigured) {
        router.replace('/login');
        return;
      }

      try {
        // Wait briefly for detectSessionInUrl to finish consuming the code.
        await new Promise((r) => setTimeout(r, 300));

        const { data: sessionData } = await supabase!.auth.getSession();
        if (!sessionData.session) {
          // OAuth error param (?error=...) or user cancelled the flow.
          setStatus('Sign-in was cancelled or failed. Redirecting…');
          setTimeout(() => router.replace('/login'), 1200);
          return;
        }

        // Validate the token actually resolves to an authenticated user.
        const { data: userData, error: userError } = await supabase!.auth.getUser();
        if (cancelled) return;

        if (userError || !userData.user) {
          console.error('Auth validation error:', userError?.message);
          setStatus('Session could not be verified. Redirecting…');
          setTimeout(() => router.replace('/login'), 1200);
          return;
        }

        router.replace('/dashboard');
      } catch (err) {
        console.error('Auth callback exception:', err);
        if (!cancelled) router.replace('/login');
      }
    };

    handleAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-pulse text-gray-700" aria-live="polite">
          {status}
        </div>
      </div>
    </div>
  );
}
