export const DEFAULT_MAX_ITEMS = 10;

export function escapeMarkdownText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/[*_`~\[\]>#|-]/g, (ch) => `\\${ch}`)
    .trim();
}

function itemLabel(item: any) {
  const type = item.kind === 'issue' ? 'Issue' : 'PR';
  const number = item.number ? ` #${item.number}` : '';
  const suffix = item.url ? ` (<${item.url}|open>)` : '';
  return `${type}${number}: *"${escapeMarkdownText(item.title) || 'Untitled'}"*${suffix}`;
}

export function generateMarkdownDigest(
  teamName: string,
  categorization: { completedTasks: any[]; activeWork: any[]; inactiveMembers: any[] },
  options: { maxItemsPerSection?: number; timeWindowLabel?: string } = {}
): string {
  const maxItems = options.maxItemsPerSection ?? DEFAULT_MAX_ITEMS;
  const timeWindow = options.timeWindowLabel ?? 'Past 24 Hours';
  const { completedTasks = [], activeWork = [], inactiveMembers = [] } = categorization || {};

  const lines: string[] = [];
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

export function enforcePlatformLimit(markdown: string, platform: string): string {
  const LIMITS: Record<string, number> = { discord: 2000, slack: 39000 };
  const limit = LIMITS[platform] ?? 2000;
  if (markdown.length <= limit) return markdown;
  const notice = `\n\n_…digest truncated to fit ${platform} payload limits._`;
  return markdown.slice(0, limit - notice.length) + notice;
}
