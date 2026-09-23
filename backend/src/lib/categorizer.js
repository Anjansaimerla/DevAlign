/**
 * Smart Categorization engine (smartcategorization.md).
 *
 * Pure, stateless, read-only: accepts raw activity log rows + team roster,
 * returns structured buckets. Never mutates inputs.
 *
 * - Completed Tasks: ONLY merged PRs (action === 'closed' && merged === true)
 *   and explicitly closed issues (Rule 3.1).
 * - Active Work: pushes with commit messages + opened/reopened/synchronized PRs.
 * - Inactive Members: roster members with zero events in the window (Rule 3.3).
 */

const INACTIVITY_THRESHOLD_HOURS = 72;

/**
 * @param {Array<{event_type: string, actor_github_username: string, payload_summary: object, created_at?: string}>} logs
 * @param {string[]} teamMembers GitHub usernames from the official roster
 * @param {{ now?: Date, thresholdHours?: number }} [options]
 */
function categorizeActivityLogs(logs = [], teamMembers = [], options = {}) {
  const result = {
    completedTasks: [],
    activeWork: [],
    activeContributors: new Set(),
    inactiveMembers: [],
  };

  for (const log of Array.isArray(logs) ? logs : []) {
    try {
      const payload = log?.payload_summary || {};
      const actor = log?.actor_github_username;
      if (!actor) continue;

      result.activeContributors.add(actor);

      if (log.event_type === 'pull_request') {
        const pr = payload.pull_request || {
          title: payload.pr_title,
          html_url: payload.pr_html_url,
          number: payload.pr_number,
          merged: payload.pr_merged,
        };

        // Strict Completed Tasks qualification (Rule 3.1)
        if (payload.action === 'closed' && pr.merged === true) {
          result.completedTasks.push({
            author: actor,
            kind: 'pr',
            number: pr.number ?? null,
            title: pr.title || 'Untitled PR',
            url: pr.html_url || null,
          });
        } else if (payload.action === 'opened' || payload.action === 'reopened' || payload.action === 'synchronize') {
          result.activeWork.push({
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
          result.completedTasks.push({
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
          result.activeWork.push({
            author: actor,
            kind: 'push',
            branch,
            commitCount: payload.commit_count ?? 0,
            message: null,
          });
        } else {
          messages.forEach((message) => {
            result.activeWork.push({
              author: actor,
              kind: 'push',
              branch,
              commitCount: messages.length,
              message,
            });
          });
        }
      }
      // Unknown event types are intentionally ignored (graceful skip).
    } catch (err) {
      // Rule 2.3: skip malformed records, keep processing the rest.
      console.warn(`Skipping malformed activity log ${log?.id ?? '<unknown>'}:`, err.message);
    }
  }

  // Inactive members (roster cross-reference)
  const thresholdHours = options.thresholdHours ?? INACTIVITY_THRESHOLD_HOURS;
  const now = options.now ?? new Date();
  const roster = Array.isArray(teamMembers) ? teamMembers : [];
  if (roster.length > 0) {
    roster.forEach((member) => {
      if (!result.activeContributors.has(member)) {
        result.inactiveMembers.push({
          username: member,
          reason: `No activity logged in the past ${thresholdHours} hours.`,
        });
      }
    });
  }

  return {
    completedTasks: result.completedTasks,
    activeWork: result.activeWork,
    inactiveMembers: result.inactiveMembers,
    activeContributors: result.activeContributors,
  };
}

/**
 * Blocker & Inactivity Detection (blocker.md) — deterministic 72h threshold
 * evaluated over the last activity timestamp per roster member. O(n) with a
 * hash map; read-only over the fetched logs.
 */
function detectInactiveMembers(teamMembers, activityLogs, thresholdHours = 72, now = new Date()) {
  const roster = Array.isArray(teamMembers) ? teamMembers : [];
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  const lastActiveMap = new Map(roster.map((m) => [m, null]));

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

  const inactive = [];
  for (const member of roster) {
    const lastActive = lastActiveMap.get(member);
    if (!lastActive || now - lastActive > thresholdMs) {
      inactive.push({
        username: member,
        lastActive: lastActive ? lastActive.toISOString() : 'No recorded activity',
      });
    }
  }
  return inactive;
}

module.exports = {
  categorizeActivityLogs,
  detectInactiveMembers,
  INACTIVITY_THRESHOLD_HOURS,
};
