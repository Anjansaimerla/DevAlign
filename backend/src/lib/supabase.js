const { createClient } = require('@supabase/supabase-js');

/**
 * Lazily-created Supabase client using the SERVICE ROLE key.
 *
 * Per tenantrules Rule 4.1 this key bypasses RLS and is only ever used in
 * trusted server contexts (webhook ingestion gateway + background workers).
 * It must never leak into any frontend bundle.
 */
let adminClient = null;

/** Tolerates project URLs saved without an explicit scheme (e.g. "xyz.supabase.co"). */
function normalizeSupabaseUrl(raw) {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getSupabaseAdmin() {
  if (!adminClient) {
    const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured before use.'
      );
    }

    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** Test-only helper so unit tests can rebuild the client after env changes. */
function resetSupabaseAdminForTests() {
  adminClient = null;
}

module.exports = { getSupabaseAdmin, resetSupabaseAdminForTests };
