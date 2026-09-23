import { getSupabaseAdmin } from './supabaseAdmin';
import { categorizeActivityLogs, detectInactiveMembers, INACTIVITY_THRESHOLD_HOURS } from './categorizer';
import { generateMarkdownDigest, enforcePlatformLimit } from './digestFormatter';
import { dispatchDigestToChat } from './chatDispatcher';

const WINDOW_HOURS = 24;

async function fetchTeamRoster(supabase: any, teamId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('github_username')
    .eq('team_id', teamId);

  if (error) {
    console.warn(`Could not fetch roster for team ${teamId}: ${error.message}`);
    return [];
  }
  return (data || []).map((m: any) => m.github_username).filter(Boolean);
}

export async function generateDigestForTeam(supabase: any, team: { id: string; name: string }) {
  const teamId = team.id;
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Time-bounded log fetch
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

  // 3. Format digest
  const markdown = generateMarkdownDigest(
    team.name,
    {
      completedTasks: categorization.completedTasks,
      activeWork: categorization.activeWork,
      inactiveMembers,
    },
    { timeWindowLabel: `Past ${WINDOW_HOURS} Hours` }
  );

  // 4. Fetch active integrations and dispatch
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
    console.log(`No active chat integrations for team ${team.name}; digest generated.`);
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

    if (!result.success && result.permanent && integration.id) {
      console.warn(`Flagging integration ${integration.id} (${integration.platform}) as inactive: ${result.error}`);
      await supabase.from('integrations').update({ is_active: false }).eq('id', integration.id);
    }
  }

  console.log(`Digest processed for team ${team.name} (${dispatchedCount} dispatched).`);
  return { success: true, delivered: dispatchedCount > 0, dispatchedCount, markdown };
}

export async function runDigestCycle(supabase = getSupabaseAdmin()) {
  console.log('Running daily digest aggregation cycle...');
  const { data: teams, error } = await supabase.from('teams').select('id, name');

  if (error) {
    console.error('Daily digest worker failed to fetch teams:', error.message);
    return;
  }

  const results = [];
  for (const team of (teams as any[]) || []) {
    try {
      const res = await generateDigestForTeam(supabase, team);
      results.push({ teamId: team.id, ...res });
    } catch (teamError: any) {
      console.error(`Digest generation failed for team ${team?.id}:`, teamError.message);
      results.push({ teamId: team?.id, error: teamError.message });
    }
  }
  return results;
}
