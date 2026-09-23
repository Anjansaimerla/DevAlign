import axios from 'axios';

export const REQUEST_TIMEOUT_MS = 5000;
export const MAX_RETRIES = 3;

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/[^/]+$/, '/[redacted]')}`;
  } catch {
    return '[invalid-url]';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildPlatformPayload(platform: string, markdown: string) {
  if (platform === 'discord') return { content: markdown };
  if (platform === 'slack') return { text: markdown };
  return null;
}

export async function dispatchDigestToChat(
  webhookUrl: string,
  platform: string,
  markdown: string
): Promise<{ success: boolean; permanent?: boolean; error?: string }> {
  if (!webhookUrl || !markdown) {
    console.error('Missing webhook URL or content for chat dispatch.');
    return { success: false, permanent: true, error: 'missing input' };
  }

  const payload = buildPlatformPayload(platform, markdown);
  if (!payload) {
    console.error(`Unsupported chat platform integration: ${platform}`);
    return { success: false, permanent: true, error: `unsupported platform: ${platform}` };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT_MS,
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(`Digest dispatched to ${platform} (${redactUrl(webhookUrl)}).`);
        return { success: true };
      }
    } catch (err: any) {
      const status = err.response?.status;

      if (status && status !== 429 && status !== 408 && status < 500) {
        console.error(
          `Dispatch to ${platform} failed permanently (HTTP ${status}):`,
          err.response?.data || err.message,
          redactUrl(webhookUrl)
        );
        return { success: false, permanent: true, error: `HTTP ${status}` };
      }

      if (attempt === MAX_RETRIES) {
        console.error(
          `Dispatch to ${platform} failed after ${MAX_RETRIES} attempts:`,
          err.response?.data || err.message,
          redactUrl(webhookUrl)
        );
        return { success: false, error: err.message };
      }

      const retryAfterHeader = err.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfterHeader
        ? Math.min(parseInt(retryAfterHeader, 10) * 1000 || 1000, 15000)
        : 1000 * 2 ** (attempt - 1);
      console.warn(
        `Dispatch to ${platform} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${retryAfterMs}ms...`
      );
      await sleep(retryAfterMs);
    }
  }
  return { success: false, error: 'unreachable' };
}

export async function testIntegrationPing(webhookUrl: string, platform: string) {
  const pingMessage = `🔔 *DevAlign Test Ping* | Connected successfully to ${platform === 'discord' ? 'Discord' : 'Slack'}! Webhook delivery is active.`;
  return dispatchDigestToChat(webhookUrl, platform, pingMessage);
}
