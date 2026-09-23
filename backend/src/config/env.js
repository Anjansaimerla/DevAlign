/**
 * Fail-fast environment secret validation (envsecretrules Rule 4.1).
 * The server must refuse to start in an insecure state rather than
 * silently accepting unverified webhooks or missing DB credentials.
 */
const REQUIRED_SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GITHUB_WEBHOOK_SECRET',
];

/**
 * Validates that every mandatory secret is present and non-empty.
 * @param {{ exitOnError?: boolean, logger?: console }} options
 * @returns {boolean} true when the environment is complete.
 */
function validateEnvironmentSecrets({ exitOnError = true, logger = console } = {}) {
  const missingSecrets = REQUIRED_SECRETS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missingSecrets.length > 0) {
    logger.error(
      `FATAL: Missing required environment variables: ${missingSecrets.join(', ')}. ` +
        'Configure them in .env (local) or via the hosting platform secret manager (production).'
    );
    if (exitOnError) {
      process.exit(1);
    }
    return false;
  }

  // Format checks: catch malformed values at startup, not deep inside clients.
  const supabaseUrl = String(process.env.SUPABASE_URL).trim();
  if (!/^https?:\/\//i.test(supabaseUrl)) {
    logger.error(
      'FATAL: SUPABASE_URL must be a valid HTTP(S) URL ' +
        `(got "${supabaseUrl.slice(0, 40)}"). Did you forget the https:// prefix?`
    );
    if (exitOnError) {
      process.exit(1);
    }
    return false;
  }

  logger.log('Environment secret validation passed successfully.');
  return true;
}

module.exports = { REQUIRED_SECRETS, validateEnvironmentSecrets };
