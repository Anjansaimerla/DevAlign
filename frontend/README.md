# Frontend — DevAlign Dashboard

Next.js (App Router) lead dashboard: GitHub OAuth via Supabase, team velocity metrics, connected repositories, member roster, and recent activity.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## Required environment variables (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public; all queries are RLS-scoped) |

> Only `NEXT_PUBLIC_`-prefixed, non-sensitive values may live here. The service
> role key must never appear in the frontend.

## Supabase configuration

1. Run `supabase/migrations/001_initial_schema.sql` and `002_security_hardening.sql` in the SQL editor.
2. Enable the GitHub OAuth provider under Authentication → Providers.
3. Add `http://localhost:3000/auth/callback` (and your production URL) to the Site/Redirect URLs.
