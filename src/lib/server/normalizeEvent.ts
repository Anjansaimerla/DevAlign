export const SNIPPET_MAX_LENGTH = 120;

export function truncate(value: unknown, maxLength = SNIPPET_MAX_LENGTH): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

export function branchFromRef(ref: unknown): string {
  if (typeof ref !== 'string') return '';
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

export function normalizeEvent(eventType: string, payload: any = {}) {
  const repoFullName = payload?.repository?.full_name || '';
  const actor = payload?.sender?.login || 'unknown';

  const base = {
    repo_full_name: repoFullName,
    actor,
    action: null as string | null,
  };

  switch (eventType) {
    case 'push': {
      const commits = Array.isArray(payload?.commits) ? payload.commits : [];
      return {
        ...base,
        action: 'pushed',
        branch: branchFromRef(payload?.ref),
        commit_count: commits.length,
        commit_messages: commits.slice(0, 20).map((c: any) => truncate(c?.message)),
      };
    }
    case 'pull_request': {
      const pr = payload?.pull_request || {};
      return {
        ...base,
        action: payload?.action || null,
        pr_number: pr.number ?? null,
        pr_title: truncate(pr.title),
        pr_merged: pr.merged === true,
        pr_html_url: pr.html_url || null,
      };
    }
    case 'issues':
    case 'issue': {
      const issue = payload?.issue || {};
      return {
        ...base,
        action: payload?.action || null,
        issue_number: issue.number ?? null,
        issue_title: truncate(issue.title),
        issue_html_url: issue.html_url || null,
      };
    }
    case 'ping':
      return { ...base, action: 'ping' };
    default:
      return { ...base, action: null };
  }
}
