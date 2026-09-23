const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-hub-signature-256';

/**
 * GitHub webhook HMAC SHA-256 verification middleware.
 *
 * Guardrails implemented (cryptorules / gitwebhookingestrules):
 * - Rule 2.1: requests missing X-Hub-Signature-256 are rejected with 401.
 * - Rule 3.1: constant-time comparison via crypto.timingSafeEqual.
 * - Rule 3.2: the digest is computed over the RAW request body captured by
 *   the express.json() `verify` hook. Re-serializing parsed JSON can change
 *   whitespace/key ordering and break valid signatures.
 * - Rule 5.2: error responses stay generic to avoid leaking internals.
 */
function verifyGitHubSignature(req, res, next) {
  const signature = req.headers[SIGNATURE_HEADER];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!signature) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  if (!secret) {
    // cryptorules Rule 4.2: never fall back to unverified processing.
    console.error('CRITICAL: GITHUB_WEBHOOK_SECRET is not defined in environment variables.');
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  try {
    const rawBody =
      typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : JSON.stringify(req.body ?? {});

    const digest = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const digestBuffer = Buffer.from(digest, 'utf8');

    // Length check first: timingSafeEqual throws on mismatched lengths.
    if (
      signatureBuffer.length !== digestBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    return next();
  } catch (err) {
    console.error('Signature verification error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = verifyGitHubSignature;
