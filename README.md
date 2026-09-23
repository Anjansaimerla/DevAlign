# DevAlign (TeamSync Digest)

DevAlign is an automated tool that aggregates GitHub activity for development teams and delivers structured status digests directly into Discord or Slack.

## 🚀 Features
- **Automated Ingestion:** Securely receives GitHub webhooks for pushes, PRs, and issues.
- **Asynchronous Processing:** Immediate acknowledgment of webhooks to satisfy GitHub timeouts.
- **Daily Digests:** Scheduled background workers aggregate activity and push Markdown digests to chat workspaces.
- **Lead Dashboard:** A Next.js dashboard for team leads to monitor velocity and activity.

## 🛠️ Tech Stack
- **Frontend:** Next.js, Tailwind CSS, Lucide React
- **Backend:** Node.js, Express, Node-cron
- **Database & Auth:** Supabase (PostgreSQL, Auth)
- **Infrastructure:** Render (Backend), Vercel (Frontend)

## ⚙️ Setup

### Backend
1. Navigate to `backend/`
2. Run `npm install`
3. Create a `.env` file with:
   - `PORT=3000`
   - `SUPABASE_URL=your-url`
   - `SUPABASE_SERVICE_ROLE_KEY=your-key`
   - `GITHUB_WEBHOOK_SECRET=your-secret`
4. Run `npm run dev`

### Frontend
1. Navigate to `frontend/`
2. Run `npm install`
3. Create a `.env.local` file with:
   - `NEXT_PUBLIC_SUPABASE_URL=your-url`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key`
4. Run `npm run dev`

### Database
Run both migration scripts in your Supabase SQL editor, in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_security_hardening.sql` (team_members roster, webhook idempotency, RLS hardening, indexes)

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env.local` as templates.

### Tests
```bash
cd backend && npm test   # node:test suite (21 tests)
cd frontend && npm run build  # typecheck + lint + build
```

## 🔒 Security
- HMAC SHA-256 signature verification for all incoming GitHub webhooks.
- Supabase Row-Level Security (RLS) to isolate team data.
- Environment variable isolation for all secrets.
