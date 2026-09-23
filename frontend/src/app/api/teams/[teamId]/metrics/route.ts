import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('event_type, actor_github_username, payload_summary, created_at')
      .eq('team_id', teamId)
      .gte('created_at', since);

    if (error) {
      console.error('Metrics query failed:', error.message);
      return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
    }

    const safeLogs = (logs as any[]) || [];
    const totalCommits = safeLogs
      .filter((l) => l.event_type === 'push')
      .reduce((sum, l) => sum + (l.payload_summary?.commit_count ?? 0), 0);
    const activePrs = safeLogs.filter(
      (l) =>
        l.event_type === 'pull_request' &&
        l.payload_summary?.action === 'opened' &&
        l.payload_summary?.pr_merged !== true
    ).length;

    const { data: rosterRows } = await supabase
      .from('team_members')
      .select('github_username')
      .eq('team_id', teamId);
    const activeActors = new Set(safeLogs.map((l) => l.actor_github_username));
    const inactiveMembers = ((rosterRows as any[]) || [])
      .map((r) => r.github_username)
      .filter((username) => username && !activeActors.has(username));

    return NextResponse.json({
      team_id: teamId,
      total_commits_24h: totalCommits,
      active_prs: activePrs,
      inactive_members: inactiveMembers,
    });
  } catch (err: any) {
    console.error('Metrics endpoint error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
