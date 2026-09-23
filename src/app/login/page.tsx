'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in? Skip the login screen.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  const handleLogin = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Fixed same-origin redirect only — never accept redirect targets from
      // query params (gitoauthrules Rule 5.2, open-redirect prevention).
      const { error: oauthError } = await supabase!.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
      // On success the browser navigates away to GitHub.
    } catch (err) {
      console.error('Unexpected login exception:', err);
      setError('Something went wrong starting the GitHub sign-in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white shadow-md rounded-lg text-center max-w-md">
        <h1 className="text-3xl font-bold mb-2">Welcome to DevAlign</h1>
        <p className="text-gray-600 mb-8">
          Align your team with automated GitHub digests — sign in to link repositories
          and receive daily standup summaries in Discord or Slack.
        </p>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="px-6 py-3 bg-black text-white rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Redirecting to GitHub…' : 'Login with GitHub'}
        </button>
        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
