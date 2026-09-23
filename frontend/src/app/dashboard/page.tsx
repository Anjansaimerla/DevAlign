'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderGit2,
  LogOut,
  Activity,
  Users,
  GitPullRequest,
  GitCommitHorizontal,
  AlertTriangle,
  Link2,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  X,
  MessageSquare,
  Radio,
  ChevronDown,
} from 'lucide-react';

type Team = { id: string; name: string; owner_id: string };
type Repo = { id: string; repo_name: string; github_repo_id: number; created_at: string };
type Member = { id: string; github_username: string; role: string };
type Integration = { id: string; platform: 'discord' | 'slack'; webhook_url: string; is_active: boolean };
type ActivityLog = {
  id: string;
  event_type: string;
  actor_github_username: string;
  payload_summary: Record<string, unknown>;
  created_at: string;
};
type PayloadSummary = {
  commit_count?: number;
  branch?: string;
  action?: string;
  pr_number?: number;
  pr_title?: string;
  pr_merged?: boolean;
  issue_number?: number;
  issue_title?: string;
  [key: string]: unknown;
};

type Metrics = {
  totalEvents: number;
  totalCommits7d: number;
  completedPRs7d: number;
  activeContributors: number;
  inactiveMembers: string[];
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function describeEvent(log: ActivityLog): string {
  const p = (log.payload_summary || {}) as PayloadSummary;
  switch (log.event_type) {
    case 'push':
      return `Pushed ${p.commit_count ?? 0} commit(s) to \`${p.branch ?? 'a branch'}\``;
    case 'pull_request':
      if (p.action === 'closed' && p.pr_merged) return `Merged PR #${p.pr_number} — ${p.pr_title}`;
      return `${String(p.action ?? 'updated')} PR #${p.pr_number} — ${p.pr_title}`;
    case 'issues':
    case 'issue':
      return `${String(p.action ?? 'updated')} issue #${p.issue_number} — ${p.issue_title}`;
    default:
      return `${log.event_type} event`;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function maskWebhook(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    if (parts.length > 2) {
      parts[parts.length - 1] = '••••••••';
    }
    return `${parsed.origin}${parts.join('/')}`;
  } catch {
    return '••••••••';
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & form state
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [githubRepoId, setGithubRepoId] = useState('');
  const [repoActionLoading, setRepoActionLoading] = useState(false);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberUsername, setMemberUsername] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'owner'>('member');
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [intPlatform, setIntPlatform] = useState<'discord' | 'slack'>('discord');
  const [intWebhookUrl, setIntWebhookUrl] = useState('');
  const [intActionLoading, setIntActionLoading] = useState(false);

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Standup Trigger & Test State
  const [triggeringStandup, setTriggeringStandup] = useState(false);
  const [standupToast, setStandupToast] = useState<{ type: 'success' | 'error'; message: string; preview?: string } | null>(null);

  const computeMetrics = useCallback((allLogs: ActivityLog[], roster: Member[]) => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = allLogs.filter((l) => new Date(l.created_at).getTime() >= cutoff);
    const contributors = new Set<string>();
    let totalCommits = 0;
    let completedPRs = 0;

    recent.forEach((log) => {
      const p = (log.payload_summary || {}) as PayloadSummary;
      if (log.actor_github_username) contributors.add(log.actor_github_username);
      if (log.event_type === 'push') totalCommits += p.commit_count ?? 0;
      if (log.event_type === 'pull_request' && p.action === 'closed' && p.pr_merged) completedPRs += 1;
    });

    const activeActors = new Set(recent.map((l) => l.actor_github_username).filter(Boolean));
    const inactiveMembers = roster
      .map((m) => m.github_username)
      .filter((username) => username && !activeActors.has(username));

    setMetrics({
      totalEvents: allLogs.length,
      totalCommits7d: totalCommits,
      completedPRs7d: completedPRs,
      activeContributors: contributors.size,
      inactiveMembers,
    });
  }, []);

  const loadTeamData = useCallback(async (currentTeam: Team) => {
    const [reposRes, membersRes, integrationsRes, logsRes] = await Promise.all([
      supabase!.from('repositories').select('*').eq('team_id', currentTeam.id).order('created_at'),
      supabase!.from('team_members').select('*').eq('team_id', currentTeam.id),
      supabase!.from('integrations').select('*').eq('team_id', currentTeam.id).order('created_at'),
      supabase!
        .from('activity_logs')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const repoData = (reposRes.data as Repo[]) ?? [];
    const memberData = (membersRes.data as Member[]) ?? [];
    const integrationData = (integrationsRes.data as Integration[]) ?? [];
    const logData = (logsRes.data as ActivityLog[]) ?? [];

    setRepos(repoData);
    setMembers(memberData);
    setIntegrations(integrationData);
    setLogs(logData);
    computeMetrics(logData, memberData);
  }, [computeMetrics]);

  const loadDashboard = useCallback(async () => {
    if (!isSupabaseConfigured) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase!.auth.getUser();
      if (authError || !user) {
        router.replace('/login');
        return;
      }

      // Teams owned by or joined by the user
      const { data: ownedTeams, error: ownedError } = await supabase!
        .from('teams')
        .select('id, name, owner_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (ownedError) console.error('Team fetch error:', ownedError.message);

      const allTeams: Team[] = (ownedTeams as Team[]) || [];

      // Also check joined teams via team_members
      const { data: memberships } = await supabase!
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const teamIds = memberships.map((m) => m.team_id).filter((id) => !allTeams.some((t) => t.id === id));
        if (teamIds.length > 0) {
          const { data: joinedTeams } = await supabase!
            .from('teams')
            .select('id, name, owner_id')
            .in('id', teamIds);
          if (joinedTeams) allTeams.push(...(joinedTeams as Team[]));
        }
      }

      setTeams(allTeams);

      const current = team && allTeams.some((t) => t.id === team.id)
        ? allTeams.find((t) => t.id === team.id)!
        : allTeams[0] ?? null;

      setTeam(current);

      if (current) {
        await loadTeamData(current);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [router, team, loadTeamData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const handleSelectTeam = async (selected: Team) => {
    setTeam(selected);
    await loadTeamData(selected);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !isSupabaseConfigured) return;
    setCreatingTeam(true);
    setTeamError(null);
    try {
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data, error } = await supabase!
        .from('teams')
        .insert({ name: newTeamName.trim(), owner_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setNewTeamName('');
      setShowTeamModal(false);
      setTeam(data as Team);
      await loadDashboard();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create team.';
      setTeamError(message);
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !repoName.trim()) return;
    setRepoActionLoading(true);
    try {
      const parsedId = githubRepoId.trim() ? parseInt(githubRepoId.trim(), 10) : Math.floor(Math.random() * 90000000) + 10000000;
      const { error } = await supabase!.from('repositories').insert({
        team_id: team.id,
        repo_name: repoName.trim(),
        github_repo_id: isNaN(parsedId) ? Math.floor(Math.random() * 90000000) + 10000000 : parsedId,
      });
      if (error) throw error;
      setRepoName('');
      setGithubRepoId('');
      setShowRepoModal(false);
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to link repository');
    } finally {
      setRepoActionLoading(false);
    }
  };

  const handleDeleteRepo = async (repoId: string) => {
    if (!team || !confirm('Are you sure you want to unlink this repository?')) return;
    try {
      const { error } = await supabase!.from('repositories').delete().eq('id', repoId);
      if (error) throw error;
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove repository');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !memberUsername.trim()) return;
    setMemberActionLoading(true);
    try {
      const { error } = await supabase!.from('team_members').insert({
        team_id: team.id,
        github_username: memberUsername.trim(),
        role: memberRole,
      });
      if (error) throw error;
      setMemberUsername('');
      setShowMemberModal(false);
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!team || !confirm('Remove this member from the team roster?')) return;
    try {
      const { error } = await supabase!.from('team_members').delete().eq('id', memberId);
      if (error) throw error;
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleAddIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !intWebhookUrl.trim()) return;
    setIntActionLoading(true);
    try {
      const { error } = await supabase!.from('integrations').insert({
        team_id: team.id,
        platform: intPlatform,
        webhook_url: intWebhookUrl.trim(),
        is_active: true,
      });
      if (error) throw error;
      setIntWebhookUrl('');
      setShowIntegrationModal(false);
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add integration');
    } finally {
      setIntActionLoading(false);
    }
  };

  const handleToggleIntegration = async (integration: Integration) => {
    if (!team) return;
    try {
      const { error } = await supabase!
        .from('integrations')
        .update({ is_active: !integration.is_active })
        .eq('id', integration.id);
      if (error) throw error;
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update integration');
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!team || !confirm('Delete this chat integration webhook?')) return;
    try {
      const { error } = await supabase!.from('integrations').delete().eq('id', integrationId);
      if (error) throw error;
      await loadTeamData(team);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete integration');
    }
  };

  const handleTriggerStandup = async () => {
    if (!team) return;
    setTriggeringStandup(true);
    setStandupToast(null);
    try {
      const { data: sessionData } = await supabase!.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('You must be logged in to trigger a digest.');

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/teams/${team.id}/digest/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to trigger digest');
      }

      setStandupToast({
        type: 'success',
        message: `Standup digest dispatched to ${json.result?.dispatchedCount ?? 0} active integration(s)!`,
        preview: json.result?.markdown,
      });
    } catch (err) {
      setStandupToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error triggering standup digest',
      });
    } finally {
      setTriggeringStandup(false);
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) await supabase!.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 animate-pulse">Loading DevAlign dashboard…</p>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <AlertTriangle className="text-amber-500 mb-4" size={40} />
        <h1 className="text-2xl font-bold mb-2">Configuration required</h1>
        <p className="text-gray-600 text-center max-w-md">
          Supabase environment variables are missing. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>frontend/.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white shadow-md rounded-xl p-8 max-w-md w-full text-center border">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard size={24} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Create your first team</h1>
          <p className="text-gray-600 mb-6">
            Name your workspace to link repositories and start receiving automated standup digests.
          </p>
          <form onSubmit={handleCreateTeam} className="flex flex-col gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g., Vignan Coders"
              required
              maxLength={60}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creatingTeam || !newTeamName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              {creatingTeam ? 'Creating…' : 'Create Team'}
            </button>
          </form>
          {teamError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
              {teamError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <LayoutDashboard size={22} />
            <span>DevAlign</span>
          </div>

          {/* Team Switcher */}
          <div className="relative inline-block text-left">
            <div className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium py-1.5 px-3 rounded-lg border transition-colors cursor-pointer">
              <span className="truncate max-w-[160px]">{team.name}</span>
              <ChevronDown size={14} className="text-gray-500" />
              <select
                aria-label="Select Team"
                value={team.id}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowTeamModal(true);
                  } else {
                    const sel = teams.find((t) => t.id === e.target.value);
                    if (sel) handleSelectTeam(sel);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value="__new__">+ Create New Team</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerStandup}
            disabled={triggeringStandup}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors disabled:opacity-50"
            title="Generate & send today's digest now"
          >
            <Send size={15} />
            <span>{triggeringStandup ? 'Dispatching…' : 'Trigger Standup Now'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors py-1.5 px-3 rounded-lg hover:bg-gray-100"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* Standup Toast / Modal */}
      {standupToast && (
        <div className="max-w-6xl mx-auto w-full px-6 pt-4">
          <div
            className={`p-4 rounded-xl border flex items-start justify-between ${
              standupToast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                {standupToast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                <span>{standupToast.message}</span>
              </div>
              {standupToast.preview && (
                <details className="mt-2 text-xs bg-white/70 p-3 rounded border font-mono whitespace-pre-wrap">
                  <summary className="cursor-pointer font-sans font-medium text-gray-700 mb-1">
                    View Generated Markdown Digest
                  </summary>
                  {standupToast.preview}
                </details>
              )}
            </div>
            <button
              onClick={() => setStandupToast(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <main className="p-6 max-w-6xl mx-auto w-full flex-1">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <p className="text-gray-500 text-sm">Team Velocity & Real-Time Sync Center</p>
          </div>
          <button
            onClick={() => loadTeamData(team)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded-lg border shadow-xs"
            title="Refresh data"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-xs border flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <GitCommitHorizontal size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Commits (7 days)</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalCommits7d ?? 0}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-xs border flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <GitPullRequest size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Merged PRs (7 days)</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.completedPRs7d ?? 0}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-xs border flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Users size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Contributors</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.activeContributors ?? 0}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-xs border flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Events Logged</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalEvents ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Inactive / Blocked Warning */}
        {metrics && metrics.inactiveMembers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold text-amber-900 text-sm">
                {metrics.inactiveMembers.length} team member(s) with no recent activity:
              </p>
              <p className="text-xs text-amber-800 mt-0.5">{metrics.inactiveMembers.join(', ')}</p>
            </div>
          </div>
        )}

        {/* Management Grid (Repos, Members, Integrations) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Connected Repositories */}
          <div className="bg-white rounded-xl shadow-xs border flex flex-col">
            <div className="px-5 py-3.5 border-b font-semibold text-gray-800 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-blue-600" />
                <span>Repositories ({repos.length})</span>
              </div>
              <button
                onClick={() => setShowRepoModal(true)}
                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              >
                <Plus size={14} /> Link Repo
              </button>
            </div>
            <div className="p-4 flex-1">
              {repos.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500">
                  <FolderGit2 className="mx-auto mb-2 text-gray-300" size={28} />
                  No repositories linked yet. Link a GitHub repository to capture webhooks.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {repos.map((repo) => (
                    <li key={repo.id} className="py-2.5 flex items-center justify-between group">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FolderGit2 size={15} className="text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800 truncate">{repo.repo_name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteRepo(repo.id)}
                        className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                        title="Unlink repository"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Team Members Roster */}
          <div className="bg-white rounded-xl shadow-xs border flex flex-col">
            <div className="px-5 py-3.5 border-b font-semibold text-gray-800 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-purple-600" />
                <span>Roster ({members.length})</span>
              </div>
              <button
                onClick={() => setShowMemberModal(true)}
                className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium hover:bg-purple-50 px-2 py-1 rounded transition-colors"
              >
                <Plus size={14} /> Add Member
              </button>
            </div>
            <div className="p-4 flex-1">
              {members.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500">
                  <Users className="mx-auto mb-2 text-gray-300" size={28} />
                  No members added. Add GitHub usernames so inactivity detection works properly.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {members.map((member) => (
                    <li key={member.id} className="py-2.5 flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{member.github_username}</span>
                        <span className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                          {member.role}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Chat Integrations */}
          <div className="bg-white rounded-xl shadow-xs border flex flex-col">
            <div className="px-5 py-3.5 border-b font-semibold text-gray-800 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-600" />
                <span>Chat Webhooks ({integrations.length})</span>
              </div>
              <button
                onClick={() => setShowIntegrationModal(true)}
                className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium hover:bg-emerald-50 px-2 py-1 rounded transition-colors"
              >
                <Plus size={14} /> Add Webhook
              </button>
            </div>
            <div className="p-4 flex-1">
              {integrations.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500">
                  <Radio className="mx-auto mb-2 text-gray-300" size={28} />
                  No Discord/Slack webhooks configured. Add one to receive automated daily standups!
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {integrations.map((int) => (
                    <li key={int.id} className="py-2.5 flex items-center justify-between group">
                      <div className="flex flex-col truncate pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              int.platform === 'discord'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {int.platform}
                          </span>
                          <span
                            className={`text-xs ${
                              int.is_active ? 'text-emerald-600 font-medium' : 'text-gray-400'
                            }`}
                          >
                            {int.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 truncate mt-0.5">
                          {maskWebhook(int.webhook_url)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleIntegration(int)}
                          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-0.5 border rounded hover:bg-gray-50"
                        >
                          {int.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteIntegration(int.id)}
                          className="text-gray-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete webhook"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-xl shadow-xs border overflow-hidden">
          <div className="px-5 py-3.5 border-b font-semibold text-gray-800 text-sm flex items-center justify-between">
            <span>Recent Activity Logs</span>
            <span className="text-xs text-gray-400 font-normal">Auto-updated on GitHub events</span>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <Activity className="mx-auto mb-2 text-gray-300" size={32} />
              No activity logged yet. Connect a repository and start pushing commits or opening PRs!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/75 text-left text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Actor</th>
                    <th className="px-5 py-3 font-semibold">Event</th>
                    <th className="px-5 py-3 font-semibold">Details</th>
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{log.actor_github_username}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono font-medium">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-md truncate">{describeEvent(log)}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{timeAgo(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Add Repository */}
      {showRepoModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Link GitHub Repository</h2>
              <button onClick={() => setShowRepoModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddRepo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Repository Name (owner/repo) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. your-org/your-repo"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  GitHub Repository ID (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 123456789"
                  value={githubRepoId}
                  onChange={(e) => setGithubRepoId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Leave blank to auto-generate a unique tracking ID.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepoModal(false)}
                  className="px-4 py-2 border text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repoActionLoading || !repoName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {repoActionLoading ? 'Linking…' : 'Link Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Team Member</h2>
              <button onClick={() => setShowMemberModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  GitHub Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. octocat"
                  value={memberUsername}
                  onChange={(e) => setMemberUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as 'member' | 'owner')}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="owner">Owner / Lead</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-4 py-2 border text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={memberActionLoading || !memberUsername.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {memberActionLoading ? 'Adding…' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Chat Integration */}
      {showIntegrationModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Chat Webhook</h2>
              <button onClick={() => setShowIntegrationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddIntegration} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Platform *</label>
                <select
                  value={intPlatform}
                  onChange={(e) => setIntPlatform(e.target.value as 'discord' | 'slack')}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="discord">Discord Incoming Webhook</option>
                  <option value="slack">Slack Incoming Webhook</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Webhook URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                  value={intWebhookUrl}
                  onChange={(e) => setIntWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIntegrationModal(false)}
                  className="px-4 py-2 border text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={intActionLoading || !intWebhookUrl.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {intActionLoading ? 'Saving…' : 'Save Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Team */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Create New Team</h2>
              <button onClick={() => setShowTeamModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  placeholder="e.g. AI Squad Alpha"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 border text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTeam || !newTeamName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {creatingTeam ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
