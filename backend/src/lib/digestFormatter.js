/**
 * Markdown digest formatter (customisabledigests.md).
 *
 * Pure function: data in -> string out. No DB, no network.
 * - Chat-safe markdown only (bold, bullets, code spans, dividers).
 * - Escapes user-authored text to prevent layout/formatting injection (Rule 4.1).
 * - Truncates long lists (top N + "and X more...") for chat limits (Rule 3.2).
 */

const DEFAULT_MAX_ITEMS = 10;

/** Strips markdown control chars from user-authored strings. */
function escapeMarkdownText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/[*_`~\[\]>#|-]/g, (ch) => `\\${ch}`)
    .trim();
}

function itemLabel(item) {
  const type = item.kind === 'issue' ? 'Issue' : 'PR';
  const number = item.number ? ` #${item.number}` : '';
  const suffix = item.url ? ` (<${item.url}|open>)` : '';
  return `${type}${number}: *"${escapeMarkdownText(item.title) || 'Untitled'}"*${suffix}`;
}

/**
 * @param {string} teamName
 * @param {{completedTasks: object[], activeWork: object[], inactiveMembers: object[]}} categorization
 * @param {{ maxItemsPerSection?: number, timeWindowLabel?: string }} [options]
 * @returns {string} chat-ready markdown digest
 */
function generateMarkdownDigest(teamName, categorization, options = {}) {
  const maxItems = options.maxItemsPerSection ?? DEFAULT_MAX_ITEMS;
  const timeWindow = options.timeWindowLabel ?? 'Past 24 Hours';
  const { completedTasks = [], activeWork = [], inactiveMembers = [] } = categorization || {};

  const lines = [];
  lines.push(`🚀 *DevAlign Daily Sync Digest* | Team: ${escapeMarkdownText(teamName) || 'Unknown'}`);
  lines.push(`*Time Window: ${escapeMarkdownText(timeWindow)}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 1: Completed Tasks
  lines.push(`✅ *Completed Tasks (${completedTasks.length})*`);
  if (completedTasks.length === 0) {
    lines.push('_No tasks completed in this window._');
  } else {
    completedTasks.slice(0, maxItems).forEach((task) => {
      lines.push(`• ${escapeMarkdownText(task.author)}: ${itemLabel(task)}`);
    });
    if (completedTasks.length > maxItems) {
      lines.push(`_and ${completedTasks.length - maxItems} more completed..._`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 2: Active Work
  lines.push(`🛠 *Active Work (${activeWork.length})*`);
  if (activeWork.length === 0) {
    lines.push('_No active work logged._');
  } else {
    activeWork.slice(0, maxItems).forEach((work) => {
      const branch = work.branch ? ` \`${escapeMarkdownText(work.branch)}\`` : '';
      if (work.kind === 'push') {
        const detail = work.message
          ? `_"${escapeMarkdownText(work.message)}"_`
          : '_no commit details_';
        lines.push(`• ${escapeMarkdownText(work.author)}: pushed to${branch || ' a branch'} — ${detail}`);
      } else {
        lines.push(`• ${escapeMarkdownText(work.author)}: ${escapeMarkdownText(work.verb || 'opened')} ${itemLabel(work)}`);
      }
    });
    if (activeWork.length > maxItems) {
      lines.push(`_and ${activeWork.length - maxItems} more events..._`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 3: Inactive / Blocked Flags
  if (inactiveMembers.length > 0) {
    lines.push(`⚠️ *Inactive / Blocked Flags (${inactiveMembers.length})*`);
    inactiveMembers.slice(0, maxItems).forEach((member) => {
      const name = escapeMarkdownText(member.username || member);
      const detail = member.reason || 'Zero commits or PRs logged over the threshold window.';
      lines.push(`• ${name}: ${escapeMarkdownText(detail)}`);
    });
    if (inactiveMembers.length > maxItems) {
      lines.push(`_and ${inactiveMembers.length - maxItems} more members..._`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Hard payload-size guard (chatintegrationrules Rule 2.2).
 * Discord caps at 2000 chars; Slack at ~40k but we keep messages short too.
 */
function enforcePlatformLimit(markdown, platform) {
  const LIMITS = { discord: 2000, slack: 39000 };
  const limit = LIMITS[platform] ?? 2000;
  if (markdown.length <= limit) return markdown;
  const notice = `\n\n_…digest truncated to fit ${platform} payload limits._`;
  return markdown.slice(0, limit - notice.length) + notice;
}

module.exports = { generateMarkdownDigest, escapeMarkdownText, enforcePlatformLimit, DEFAULT_MAX_ITEMS };
