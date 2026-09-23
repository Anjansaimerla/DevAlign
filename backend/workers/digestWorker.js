/**
 * Digest worker — the asynchronous standup replacement orchestrator
 * (standup.md + automatedactivity.md).
 *
 * Stateless: fetches teams/logs/integrations from Supabase on each run,
 * processes in memory, dispatches, terminates. Per-team try/catch isolation
 * guarantees one failing team never blocks the others (automatedactivityrules 4.1).
 */
const cron = require('node-cron');
const { getSupabaseAdmin } = require('../src/lib/supabase');
const { categorizeActivityLogs, detectInactiveMembers, INACTIVITY_THRESHOLD_HOURS } = require('../src/lib/categorizer');
const { generateMarkdownDigest, enforcePlatformLimit } = require('../src/lib/digestFormatter');
const { dispatchDigestToChat } = require('../src/lib/chatDispatcher');

const WINDOW_HOURS = 24;

/** Fetches the team roster (github usernames) for a team, tolerating absence. */
async function fetchTeamRoster(supabase, teamId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('github_username')
    .eq('team_id', teamId);

  if (error) {
    // team_members may not exist yet (pre-migration deploys) — degrade gracefully.
    console.warn(`Could not fetch roster for team ${teamId}: ${error.message}`);
    return [];
  }
  return (data || []).map((m) => m.github_username).filter(Boolean);
}

async function generateDigestForTeam(supabase, team) {
  const teamId = team.id;
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Time-bounded log fetch (automatedactivityrules Rule 2.2)
  const { data: logs, error: logError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('team_id', teamId)
    .gte('created_at', since);

  if (logError) {
    throw new Error(`Error fetching logs for team ${teamId}: ${logError.message}`);
  }

  const safeLogs = logs || [];

  // 2. Categorize + inactivity detection
  const roster = await fetchTeamRoster(supabase, teamId);
  const categorization = categorizeActivityLogs(safeLogs, roster, {
    thresholdHours: INACTIVITY_THRESHOLD_HOURS,
  });
  const inactiveDetailed = detectInactiveMembers(roster, safeLogs, INACTIVITY_THRESHOLD_HOURS);
  const inactiveMembers = inactiveDetailed.map((m) => ({
    username: m.username,
    reason:
      m.lastActive === 'No recorded activity'
        ? `No activity recorded (72h threshold).`
        : `Last activity ${m.lastActive} (over ${INACTIVITY_THRESHOLD_HOURS}h ago).`,
  }));

  // 3. Format digest — empty state still produces a full message (standuprules 5.2)
  const markdown = generateMarkdownDigest(team.name, {
    completedTasks: categorization.completedTasks,
    activeWork: categorization.activeWork,
    inactiveMembers,
  }, { timeWindowLabel: `Past ${WINDOW_HOURS} Hours` });

  // 4. Fetch active integrations and dispatch (standup.md flow step 2)
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('id, platform, webhook_url')
    .eq('team_id', teamId)
    .eq('is_active', true);

  if (intError) {
    throw new Error(`Error fetching integrations for team ${teamId}: ${intError.message}`);
  }

  let dispatchedCount = 0;
  if (!integrations || integrations.length === 0) {
    console.log(`No active chat integrations for team ${team.name}; digest generated but not delivered.`);
    return { success: true, delivered: false, dispatchedCount: 0, markdown, message: 'No active integrations configured' };
  }

  for (const integration of integrations) {
    const platformMarkdown = enforcePlatformLimit(markdown, integration.platform);
    const result = await dispatchDigestToChat(
      integration.webhook_url,
      integration.platform,
      platformMarkdown
    );

    if (result.success) {
      dispatchedCount += 1;
    }

    // chatintegrationrules Rule 4.3: deactivate dead endpoints (404 etc.)
    if (!result.success && result.permanent && integration.id) {
      console.warn(`Flagging integration ${integration.id} (${integration.platform}) as inactive: ${result.error}`);
      const { error: deactivateError } = await supabase
        .from('integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
      if (deactivateError) {
        console.error(`Failed to deactivate integration ${integration.id}:`, deactivateError.message);
      }
    }
  }

  console.log(`Digest processed for team ${team.name} (${dispatchedCount} dispatched).`);
  return { success: true, delivered: dispatchedCount > 0, dispatchedCount, markdown };
}

/** Runs one full aggregation cycle. Exposed for tests + manual runs. */
async function runDigestCycle(supabase = getSupabaseAdmin()) {
  console.log('Running daily digest aggregation worker...');
  const { data: teams, error } = await supabase.from('teams').select('id, name');

  if (error) {
    console.error('Daily digest worker failed to fetch teams:', error.message);
    return;
  }

  for (const team of teams || []) {
    try {
      await generateDigestForTeam(supabase, team);
    } catch (teamError) {
      // Multi-tenant error isolation: continue with remaining teams.
      console.error(`Digest generation failed for team ${team?.id ?? '<unknown>'}:`, teamError.message);
    }
  }
  console.log('Daily digest worker cycle completed.');
}

/**
 * Schedules the digest cycle. Runs at 18:00 UTC daily, guarded against
 * overlapping runs (long dispatch cycles must not stack).
 */
function startDigestWorker(supabase = getSupabaseAdmin()) {
  let isRunning = false;

  const schedule = process.env.DIGEST_CRON || '0 18 * * *';
  cron.schedule(
    schedule,
    async () => {
      if (isRunning) {
        console.warn('Digest worker cycle still in progress; skipping overlapping trigger.');
        return;
      }
      isRunning = true;
      try {
        await runDigestCycle(supabase);
      } catch (error) {
        console.error('Daily digest worker failed:', error);
      } finally {
        isRunning = false;
      }
    },
    { timezone: 'UTC' }
  );

  console.log(`Digest worker scheduled ("${schedule}" UTC daily).`);
  return schedule;
}

module.exports = { startDigestWorker, runDigestCycle, generateDigestForTeam };
