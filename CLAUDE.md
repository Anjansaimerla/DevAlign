# DevAlign Guide

## Project Overview
DevAlign aggregates GitHub activity and delivers daily digests to Discord/Slack.

## Development Commands
- Backend: `cd backend && npm run dev`
- Frontend: `cd frontend && npm run dev`
- Tests: `cd backend && node tests/webhook.test.js`

## Engineering Guidelines
- **Webhook Protocol:** Always acknowledge webhooks with `200 OK` immediately; process asynchronously.
- **Security:** Use `crypto.timingSafeEqual` for HMAC verification.
- **Database:** Use Supabase RLS for all tenant isolation.
- **Commits:** Use `feat:`, `fix:`, `docs:` prefixes.
