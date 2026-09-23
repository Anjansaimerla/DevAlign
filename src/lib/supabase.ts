import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Tolerates URLs saved without an explicit scheme (e.g. "xyz.supabase.co"). */
function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

// Fail loudly at build/startup when public config is missing rather than
// shipping a client that throws opaque errors deep in a page render.
// (envsecretrules: only NEXT_PUBLIC_ non-sensitive values belong here;
// the service role key must never appear in this bundle.)
let supabaseInstance;

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'FATAL: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured.'
    );
  }
  // Keep the module importable (build-time safety); page guards redirect to
  // /login with a helpful message when the client is unusable.
  supabaseInstance = null;
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = supabaseInstance !== null;
