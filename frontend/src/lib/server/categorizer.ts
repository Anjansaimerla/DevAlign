export const INACTIVITY_THRESHOLD_HOURS = 72;

export interface CompletedTask {
  author: string;
  kind: 'pr' | 'issue';
  number: number | null;
  title: string;
  url: string | null;
}

export interface ActiveWorkItem {
  author: string;
  kind: 'pr' | 'push';
  verb?: string;
  number?: number | null;
  title?: string;
  url?: string | null;
  branch?: string;
  commitCount?: number;
  message?: string | null;
}

export interface InactiveMemberItem {
  username: string;
  reason: string;
}

export function categorizeActivityLogs(
  logs: any[] = [],
  teamMembers: string[] = [],
  options: { now?: Date; thresholdHours?: number } = {}
) {
  const completedTasks: CompletedTask[] = [];
  const activeWork: ActiveWorkItem[] = [];
  const activeContributors = new Set<string>();
  const inactiveMembers: InactiveMemberItem[] = [];

  for (const log of Array.isArray(logs) ? logs : []) {
    try {
      const payload = log?.payload_summary || {};
      const actor = log?.actor_github_username;
      if (!actor) continue;

      activeContributors.add(actor);

      if (log.event_type === 'pull_request') {
        const pr = payload.pull_request || {
          title: payload.pr_title,
          html_url: payload.pr_html_url,
          number: payload.pr_number,
          merged: payload.pr_merged,
        };

        if (payload.action === 'closed' && pr.merged === true) {
          completedTasks.push({
            author: actor,
            kind: 'pr',
            number: pr.number ?? null,
            title: pr.title || 'Untitled PR',
            url: pr.html_url || null,
          });
        } else if (payload.action === 'opened' || payload.action === 'reopened' || payload.action === 'synchronize') {
          activeWork.push({
            author: actor,
            kind: 'pr',
            verb: payload.action === 'synchronize' ? 'updated' : payload.action,
            number: pr.number ?? null,
            title: pr.title || 'Untitled PR',
            url: pr.html_url || null,
          });
        }
      } else if (log.event_type === 'issues' || log.event_type === 'issue') {
        const issue = payload.issue || {
          title: payload.issue_title,
          html_url: payload.issue_html_url,
          number: payload.issue_number,
        };

        if (payload.action === 'closed') {
          completedTasks.push({
            author: actor,
            kind: 'issue',
            number: issue.number ?? null,
            title: issue.title || 'Untitled issue',
            url: issue.html_url || null,
          });
        }
      } else if (log.event_type === 'push') {
        const messages = Array.isArray(payload.commit_messages) ? payload.commit_messages : [];
        const branch = payload.branch || '';
        if (messages.length === 0) {
          activeWork.push({
            author: actor,
            kind: 'push',
            branch,
            commitCount: payload.commit_count ?? 0,
            message: null,
          });
        } else {
          messages.forEach((message: string) => {
            activeWork.push({
              author: actor,
              kind: 'push',
              branch,
              commitCount: messages.length,
              message,
            });
          });
        }
      }
    } catch (err: any) {
      console.warn(`Skipping malformed activity log ${log?.id ?? '<unknown>'}:`, err.message);
    }
  }

  const thresholdHours = options.thresholdHours ?? INACTIVITY_THRESHOLD_HOURS;
  const roster = Array.isArray(teamMembers) ? teamMembers : [];
  if (roster.length > 0) {
    roster.forEach((member) => {
      if (!activeContributors.has(member)) {
        inactiveMembers.push({
          username: member,
          reason: `No activity logged in the past ${thresholdHours} hours.`,
        });
      }
    });
  }

  return {
    completedTasks,
    activeWork,
    inactiveMembers,
    activeContributors,
  };
}

export function detectInactiveMembers(
  teamMembers: string[],
  activityLogs: any[],
  thresholdHours = 72,
  now = new Date()
) {
  const roster = Array.isArray(teamMembers) ? teamMembers : [];
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  const lastActiveMap = new Map<string, Date | null>(roster.map((m) => [m, null]));

  for (const log of logs) {
    const author = log?.actor_github_username;
    if (!author || !lastActiveMap.has(author)) continue;
    const logTime = new Date(log.created_at);
    if (Number.isNaN(logTime.getTime())) continue;
    const current = lastActiveMap.get(author);
    if (!current || logTime > current) {
      lastActiveMap.set(author, logTime);
    }
  }

  const inactive: { username: string; lastActive: string }[] = [];
  for (const member of roster) {
    const lastActive = lastActiveMap.get(member);
    if (!lastActive || now.getTime() - lastActive.getTime() > thresholdMs) {
      inactive.push({
        username: member,
        lastActive: lastActive ? lastActive.toISOString() : 'No recorded activity',
      });
    }
  }
  return inactive;
}
