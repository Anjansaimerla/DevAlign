require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { validateEnvironmentSecrets } = require('./src/config/env');
const { getSupabaseAdmin } = require('./src/lib/supabase');
const { normalizeEvent } = require('./src/lib/normalizeEvent');
const { testIntegrationPing } = require('./src/lib/chatDispatcher');
const verifyGitHubSignature = require('./middleware/verifyGitHubSignature');
const { startDigestWorker, generateDigestForTeam } = require('./workers/digestWorker');

// Fail-fast startup validation (envsecretrules Rule 4.1)
validateEnvironmentSecrets();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

/**
 * Capture the RAW body so HMAC verification hashes the exact bytes GitHub
 * signed (cryptorules Rule 3.2), then parse JSON.
 */
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const supabase = getSupabaseAdmin();

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

/** Event types worth persisting; `ping` is acknowledged but not logged. */
const INGESTED_EVENTS = new Set(['push', 'pull_request', 'issues', 'issue']);

app.post('/api/webhooks/github', verifyGitHubSignature, (req, res) => {
  const event = req.headers['x-github-event'] || 'unknown';
  const deliveryId = req.headers['x-github-delivery'] || null;
  const payload = req.body || {};

  // Zero-blocking: acknowledge instantly (<200ms, sysrules Rule 2.1)
  res.status(200).json({ status: 'received', delivery_id: deliveryId });

  // Asynchronous hand-off — never await in the request cycle
  setImmediate(async () => {
    try {
      if (event === 'ping') {
        console.log('GitHub ping received; webhook is active.');
        return;
      }

      if (!INGESTED_EVENTS.has(event)) {
        console.log(`Ignoring unsupported event type: ${event}`);
        return;
      }

      // Idempotency (gitwebhookingestrules Rule 3.3): skip duplicate deliveries.
      if (deliveryId) {
        const { data: existing, error: lookupError } = await supabase
          .from('activity_logs')
          .select('id')
          .eq('delivery_id', deliveryId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (existing) {
          console.log(`Duplicate delivery ${deliveryId} ignored (idempotent).`);
          return;
        }
      }

      const repoFullName = payload.repository?.full_name;
      if (!repoFullName) {
        console.error(`Webhook delivery ${deliveryId ?? '<no-id>'} missing repository.full_name`);
        return;
      }

      // Map repository -> team via stable github_repo_id (rename-proof),
      // falling back to repo_name.
      let repoData = null;
      const githubRepoId = payload.repository?.id;
      if (githubRepoId !== undefined && githubRepoId !== null) {
        const byId = await supabase
          .from('repositories')
          .select('team_id')
          .eq('github_repo_id', githubRepoId)
          .maybeSingle();
        if (byId.error) throw byId.error;
        repoData = byId.data;
      }
      if (!repoData) {
        const byName = await supabase
          .from('repositories')
          .select('team_id')
          .eq('repo_name', repoFullName)
          .maybeSingle();
        if (byName.error) throw byName.error;
        repoData = byName.data;
      }

      if (!repoData) {
        console.warn(`Repository ${repoFullName} is not registered; event ${event} dropped.`);
        return;
      }

      const normalized = normalizeEvent(event, payload);
      const { error: insertError } = await supabase.from('activity_logs').insert({
        team_id: repoData.team_id,
        event_type: event,
        actor_github_username: normalized.actor,
        payload_summary: normalized,
        delivery_id: deliveryId,
      });

      if (insertError) {
        // Unique constraint hit = concurrent duplicate delivery; not an error.
        if (insertError.code === '23505') {
          console.log(`Duplicate delivery ${deliveryId ?? ''} raced; already logged.`);
          return;
        }
        throw insertError;
      }

      console.log(`Logged ${event} event (delivery ${deliveryId ?? 'n/a'}) for team ${repoData.team_id}.`);
    } catch (error) {
      console.error(`Error processing webhook delivery ${deliveryId ?? '<unknown>'}:`, error);
    }
  });
});

/**
 * GET /api/teams/:teamId/metrics — TRD §5.2 contract.
 * Bearer token = Supabase access token; RLS scopes all results to the caller's team.
 */
app.get('/api/teams/:teamId/metrics', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const teamId = req.params.teamId;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('event_type, actor_github_username, payload_summary, created_at')
      .eq('team_id', teamId)
      .gte('created_at', since);

    if (error) {
      console.error('Metrics query failed:', error.message);
      return res.status(500).json({ error: 'Failed to load metrics' });
    }

    const safeLogs = logs || [];
    const totalCommits = safeLogs
      .filter((l) => l.event_type === 'push')
      .reduce((sum, l) => sum + (l.payload_summary?.commit_count ?? 0), 0);
    const activePrs = safeLogs.filter(
      (l) =>
        l.event_type === 'pull_request' &&
        l.payload_summary?.action === 'opened' &&
        l.payload_summary?.pr_merged !== true
    ).length;

    // Inactive members: roster members with no events in the window
    const { data: rosterRows } = await supabase
      .from('team_members')
      .select('github_username')
      .eq('team_id', teamId);
    const activeActors = new Set(safeLogs.map((l) => l.actor_github_username));
    const inactiveMembers = (rosterRows || [])
      .map((r) => r.github_username)
      .filter((username) => username && !activeActors.has(username));

    return res.status(200).json({
      team_id: teamId,
      total_commits_24h: totalCommits,
      active_prs: activePrs,
      inactive_members: inactiveMembers,
    });
  } catch (err) {
    console.error('Metrics endpoint error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/teams/:teamId/digest/trigger — On-demand standup digest execution.
 * Authenticated via Supabase access token.
 */
app.post('/api/teams/:teamId/digest/trigger', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const teamId = req.params.teamId;
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError || !team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const result = await generateDigestForTeam(supabase, team);
    return res.status(200).json({
      success: true,
      message: 'Digest triggered successfully',
      result,
    });
  } catch (err) {
    console.error('Manual digest trigger error:', err);
    return res.status(500).json({ error: 'Failed to trigger digest', details: err.message });
  }
});

/**
 * POST /api/teams/:teamId/integrations/test — Send test ping to Discord/Slack webhook.
 * Authenticated via Supabase access token.
 */
app.post('/api/teams/:teamId/integrations/test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { webhook_url, platform } = req.body || {};
    if (!webhook_url || !platform) {
      return res.status(400).json({ error: 'Missing webhook_url or platform' });
    }

    const pingResult = await testIntegrationPing(webhook_url, platform);
    if (!pingResult.success) {
      return res.status(400).json({
        success: false,
        error: pingResult.error || 'Failed to dispatch test message to webhook',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Test ping dispatched successfully to ${platform}!`,
    });
  } catch (err) {
    console.error('Integration test error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// JSON parse failures and bad requests -> sanitized 400, never a crash.
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  console.error('Unhandled middleware error:', err);
  return res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
  startDigestWorker(supabase);
});

// Last-resort fault isolation: a stray rejection never kills ingestion.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception; shutting down:', err);
  server.close(() => process.exit(1));
});

module.exports = { app, server };
