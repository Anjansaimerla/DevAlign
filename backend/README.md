# Backend — DevAlign

Express API: GitHub webhook ingestion, HMAC verification, activity aggregation, and scheduled digest dispatch.

## Scripts

- `npm run dev` — start with nodemon (auto-reload)
- `npm start` — start in production
- `npm test` — run the `node:test` suite

## Required environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default 3000) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server only**, bypasses RLS |
| `GITHUB_WEBHOOK_SECRET` | Shared HMAC secret configured on the GitHub webhook |
| `DIGEST_CRON` | Optional cron override (default `0 18 * * *`, UTC) |

The server **refuses to start** if any required secret is missing (fail-fast validation).

## Endpoints

- `GET /health` — liveness probe
- `POST /api/webhooks/github` — GitHub webhook receiver (HMAC SHA-256 verified, responds <200ms, processes asynchronously)
- `GET /api/teams/:teamId/metrics` — 24h metrics per TRD §5.2 (requires `Authorization: Bearer <supabase-token>`)

## Architecture notes

- Signature verification hashes the **raw request body** captured by the `express.json()` verify hook.
- Webhook ingestion is idempotent: deliveries are deduplicated via `X-GitHub-Delivery` against the unique `delivery_id` index.
- Raw payloads are normalized into a compact `payload_summary` JSONB projection; raw bytes stay immutable.
- Digest worker (`workers/digestWorker.js`): cron at 18:00 UTC, per-team error isolation, empty-state digests, retry with `Retry-After`/backoff, and auto-deactivation of dead webhooks (404).
