const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const verifyGitHubSignature = require('../middleware/verifyGitHubSignature');
const { normalizeEvent } = require('../src/lib/normalizeEvent');
const { categorizeActivityLogs, detectInactiveMembers } = require('../src/lib/categorizer');
const { generateMarkdownDigest, escapeMarkdownText, enforcePlatformLimit } = require('../src/lib/digestFormatter');
const { buildPlatformPayload, redactUrl, testIntegrationPing } = require('../src/lib/chatDispatcher');
const { validateEnvironmentSecrets } = require('../src/config/env');

process.env.GITHUB_WEBHOOK_SECRET = 'test_secret';

// ---------------------------------------------------------------------------
// Mock helper for zero-dependency middleware testing
// ---------------------------------------------------------------------------
function mockReq(headers = {}, body = {}, rawBody = null) {
  return {
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    body,
    rawBody: rawBody ?? (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        resolve({ status: statusCode, body: responseBody });
        return this;
      },
      send(body) {
        responseBody = body;
        resolve({ status: statusCode, body: responseBody });
        return this;
      },
    };
    const next = () => {
      resolve({ status: 200, nextCalled: true });
    };
    try {
      middleware(req, res, next);
    } catch (err) {
      resolve({ status: 500, error: err });
    }
  });
}

function sign(body, secret = 'test_secret') {
  const content = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  return 'sha256=' + crypto.createHmac('sha256', secret).update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// 1. Signature Verification Middleware Tests
// ---------------------------------------------------------------------------
test('accepts a request with a valid HMAC SHA-256 signature computed over raw body', async () => {
  const payload = { event: 'push', repo: 'test/repo', nested: { a: 1 } };
  const rawString = JSON.stringify(payload);
  const signature = sign(rawString);

  const req = mockReq({ 'x-hub-signature-256': signature }, payload, rawString);
  const result = await runMiddleware(verifyGitHubSignature, req);

  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.nextCalled, true);
});

test('rejects a tampered payload (signature of different body)', async () => {
  const payload = { event: 'push', repo: 'test/repo' };
  const evilSignature = sign(JSON.stringify({ event: 'push', repo: 'EVIL/repo' }));

  const req = mockReq({ 'x-hub-signature-256': evilSignature }, payload);
  const result = await runMiddleware(verifyGitHubSignature, req);

  assert.strictEqual(result.status, 401);
  assert.deepStrictEqual(result.body, { error: 'Invalid webhook signature.' });
});

test('rejects a missing signature header with 401', async () => {
  const req = mockReq({}, { a: 1 });
  const result = await runMiddleware(verifyGitHubSignature, req);

  assert.strictEqual(result.status, 401);
  assert.deepStrictEqual(result.body, { error: 'Invalid webhook signature.' });
});

test('rejects malformed signature buffers without crashing', async () => {
  const req = mockReq({ 'x-hub-signature-256': 'sha256=zz-not-hex' }, { a: 1 });
  const result = await runMiddleware(verifyGitHubSignature, req);

  assert.strictEqual(result.status, 401);
});

test('handles missing GITHUB_WEBHOOK_SECRET by returning 500 fail-safe', async () => {
  const savedSecret = process.env.GITHUB_WEBHOOK_SECRET;
  delete process.env.GITHUB_WEBHOOK_SECRET;

  const payload = { a: 1 };
  const req = mockReq({ 'x-hub-signature-256': 'sha256=123' }, payload);
  const result = await runMiddleware(verifyGitHubSignature, req);

  assert.strictEqual(result.status, 500);
  assert.deepStrictEqual(result.body, { error: 'Internal Server Error' });

  process.env.GITHUB_WEBHOOK_SECRET = savedSecret;
});

test('works with rawBody as Buffer', async () => {
  const payload = { hello: 'world' };
  const rawBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = sign(rawBuf);

  const req = {
    headers: { 'x-hub-signature-256': signature },
    body: payload,
    rawBody: rawBuf,
  };
  const result = await runMiddleware(verifyGitHubSignature, req);

  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.nextCalled, true);
});

// ---------------------------------------------------------------------------
// 2. Event Normalization Tests
// ---------------------------------------------------------------------------
test('normalizeEvent extracts push metadata safely', () => {
  const normalized = normalizeEvent('push', {
    ref: 'refs/heads/feature/login',
    sender: { login: 'anjan-dev' },
    repository: { full_name: 'anjan-dev/devalign' },
    commits: [
      { id: '1', message: 'feat: add auth' },
      { id: '2', message: 'fix: timeout' },
    ],
  });
  assert.strictEqual(normalized.actor, 'anjan-dev');
  assert.strictEqual(normalized.branch, 'feature/login');
  assert.strictEqual(normalized.commit_count, 2);
  assert.deepStrictEqual(normalized.commit_messages, ['feat: add auth', 'fix: timeout']);
});

test('normalizeEvent tolerates missing/malformed payloads', () => {
  const normalized = normalizeEvent('push', {});
  assert.strictEqual(normalized.actor, 'unknown');
  assert.strictEqual(normalized.commit_count, 0);
  assert.deepStrictEqual(normalized.commit_messages, []);
  assert.doesNotThrow(() => normalizeEvent('push', null));
  assert.doesNotThrow(() => normalizeEvent('pull_request', undefined));
});

test('normalizeEvent captures PR merge state and issue fields', () => {
  const pr = normalizeEvent('pull_request', {
    action: 'closed',
    sender: { login: 'dev1' },
    pull_request: { number: 14, title: 'feat: x', merged: true, html_url: 'https://github.com/x/y/pull/14' },
  });
  assert.strictEqual(pr.pr_merged, true);
  assert.strictEqual(pr.pr_number, 14);

  const issue = normalizeEvent('issues', {
    action: 'closed',
    sender: { login: 'dev2' },
    issue: { number: 8, title: 'fix db timeout' },
  });
  assert.strictEqual(issue.issue_number, 8);
  assert.strictEqual(issue.action, 'closed');
});

// ---------------------------------------------------------------------------
// 3. Categorization & Inactivity Tests
// ---------------------------------------------------------------------------
const LOG = (over = {}) => ({
  id: 'log-' + Math.random(),
  event_type: 'push',
  actor_github_username: 'dev1',
  created_at: new Date().toISOString(),
  payload_summary: { branch: 'main', commit_count: 1, commit_messages: ['work'] },
  ...over,
});

test('only merged PRs and closed issues land in Completed Tasks', () => {
  const result = categorizeActivityLogs([
    LOG({ event_type: 'pull_request', payload_summary: { action: 'closed', pr_merged: true, pr_title: 'Merged PR' } }),
    LOG({ event_type: 'pull_request', payload_summary: { action: 'closed', pr_merged: false, pr_title: 'Closed unmerged' } }),
    LOG({ event_type: 'pull_request', payload_summary: { action: 'opened', pr_title: 'Open PR' } }),
    LOG({ event_type: 'issues', payload_summary: { action: 'closed', issue_title: 'Closed issue' } }),
    LOG({ event_type: 'issues', payload_summary: { action: 'opened', issue_title: 'Open issue' } }),
  ]);
  assert.strictEqual(result.completedTasks.length, 2);
  assert.ok(result.completedTasks.some((t) => t.kind === 'pr' && t.title === 'Merged PR'));
  assert.ok(result.completedTasks.some((t) => t.kind === 'issue' && t.title === 'Closed issue'));
  assert.strictEqual(result.activeWork.length, 1);
});

test('pushes and opened PRs land in Active Work; contributors tracked in a Set', () => {
  const result = categorizeActivityLogs([
    LOG({ payload_summary: { branch: 'main', commit_count: 2, commit_messages: ['a', 'b'] } }),
    LOG({ event_type: 'pull_request', payload_summary: { action: 'opened', pr_title: 'New PR' } }),
  ], ['dev1', 'dev2']);
  assert.strictEqual(result.activeWork.length, 3); // 2 commits + 1 PR
  assert.ok(result.activeContributors instanceof Set);
  assert.ok(result.activeContributors.has('dev1'));
  assert.deepStrictEqual(result.inactiveMembers.map((m) => m.username), ['dev2']);
});

test('malformed log entries never crash the parser', () => {
  const result = categorizeActivityLogs([LOG({ payload_summary: null }), LOG()]);
  assert.strictEqual(result.activeWork.length, 2);
  assert.doesNotThrow(() =>
    categorizeActivityLogs([null, undefined, {}, LOG({ payload_summary: 'not-an-object' })])
  );
});

test('categorization is read-only (inputs unmutated)', () => {
  const logs = [LOG()];
  const snapshot = JSON.stringify(logs);
  categorizeActivityLogs(logs, ['dev1']);
  assert.strictEqual(JSON.stringify(logs), snapshot);
});

test('detectInactiveMembers flags roster members over the 72h threshold', () => {
  const now = new Date('2026-09-23T12:00:00Z');
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
  const fourDaysAgo = new Date(now.getTime() - 96 * 3600 * 1000).toISOString();

  const inactive = detectInactiveMembers(
    ['active-dev', 'stale-dev', 'ghost-dev'],
    [
      { actor_github_username: 'active-dev', created_at: twoDaysAgo },
      { actor_github_username: 'stale-dev', created_at: fourDaysAgo },
    ],
    72,
    now
  );
  assert.deepStrictEqual(inactive.map((m) => m.username), ['stale-dev', 'ghost-dev']);
  assert.strictEqual(inactive[1].lastActive, 'No recorded activity');
});

test('unlinked actors in logs never poison roster flags', () => {
  const inactive = detectInactiveMembers(
    ['dev1'],
    [{ actor_github_username: 'outsider', created_at: new Date().toISOString() }],
    72
  );
  assert.deepStrictEqual(inactive.map((m) => m.username), ['dev1']);
});

// ---------------------------------------------------------------------------
// 4. Digest Formatting Tests
// ---------------------------------------------------------------------------
test('digest has the standup triad with empty-state fallbacks', () => {
  const md = generateMarkdownDigest('Vignan Coders', {
    completedTasks: [], activeWork: [], inactiveMembers: [],
  });
  assert.match(md, /Completed Tasks \(0\)/);
  assert.match(md, /No tasks completed in this window\./);
  assert.match(md, /No active work logged\./);
  assert.ok(!md.includes('Inactive / Blocked Flags'), 'empty inactive section is omitted');
});

test('digest escapes markdown metacharacters in user content', () => {
  const md = generateMarkdownDigest('Team *Bold*', {
    completedTasks: [{ kind: 'pr', author: 'dev', number: 1, title: 'DROP **TABLE** #stuff' }],
    activeWork: [],
    inactiveMembers: [],
  });
  assert.ok(!md.includes('**TABLE**'), 'unescaped ** must not survive');
  assert.ok(md.includes('\\*\\*'));
  assert.ok(md.includes('Team \\*Bold\\*'));
});

test('long lists truncate with an "and N more" suffix', () => {
  const tasks = Array.from({ length: 15 }, (_, i) => ({
    kind: 'pr', author: 'dev', number: i, title: `PR ${i}`,
  }));
  const md = generateMarkdownDigest('Team', { completedTasks: tasks, activeWork: [], inactiveMembers: [] });
  assert.match(md, /and 5 more completed\.\.\./);
  assert.ok(!md.includes('PR 14)'));
});

test('enforcePlatformLimit hard-truncates Discord payloads to 2000 chars', () => {
  const huge = 'x'.repeat(5000);
  const truncated = enforcePlatformLimit(huge, 'discord');
  assert.ok(truncated.length <= 2000);
  assert.match(truncated, /digest truncated/);
  assert.strictEqual(enforcePlatformLimit('short', 'slack'), 'short');
});

// ---------------------------------------------------------------------------
// 5. Chat Dispatcher Tests
// ---------------------------------------------------------------------------
test('payloads map to platform schemas', () => {
  assert.deepStrictEqual(buildPlatformPayload('discord', 'hi'), { content: 'hi' });
  assert.deepStrictEqual(buildPlatformPayload('slack', 'hi'), { text: 'hi' });
  assert.strictEqual(buildPlatformPayload('teams', 'hi'), null);
});

test('redactUrl masks the webhook token path segment', () => {
  const redacted = redactUrl('https://discord.com/api/webhooks/123456/super-secret-token');
  assert.ok(!redacted.includes('super-secret-token'));
  assert.ok(redacted.includes('discord.com'));
});

// ---------------------------------------------------------------------------
// 6. Environment Secret Validation Tests
// ---------------------------------------------------------------------------
test('validateEnvironmentSecrets detects missing secrets without exiting', () => {
  const saved = { ...process.env };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.GITHUB_WEBHOOK_SECRET;

  const errors = [];
  const ok = validateEnvironmentSecrets({
    exitOnError: false,
    logger: { log: () => {}, error: (m) => errors.push(m) },
  });

  assert.strictEqual(ok, false);
  assert.strictEqual(errors.length, 1);
  assert.ok(errors[0].includes('SUPABASE_URL'));
  assert.ok(errors[0].includes('GITHUB_WEBHOOK_SECRET'));

  process.env = saved;
});

// ---------------------------------------------------------------------------
// 7. Integration Ping & Health Validation Tests
// ---------------------------------------------------------------------------
test('testIntegrationPing returns missing input on empty URL', async () => {
  const result = await testIntegrationPing('', 'discord');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'missing input');
});

test('testIntegrationPing returns unsupported platform on unknown platform', async () => {
  const result = await testIntegrationPing('https://discord.com/api/webhooks/123/abc', 'unknown-platform');
  assert.strictEqual(result.success, false);
  assert.ok(result.error.includes('unsupported platform'));
});
