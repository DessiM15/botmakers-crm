const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'RESEND_API_KEY',
  'ANTHROPIC_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

const optionalVars = [
  'SQUARE_APPLICATION_ID',
  'SQUARE_ACCESS_TOKEN',
  'SQUARE_LOCATION_ID',
  'SQUARE_WEBHOOK_SIGNATURE_KEY',
  'GITHUB_TOKEN',
  'GITHUB_ORG',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'CRON_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  'VERCEL_WEBHOOK_SECRET',
  'EMAIL_FROM',
  'EMAIL_LEADS_FROM',
];

function validateEnv() {
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nAdd them to .env.local or your hosting provider's environment settings.`
    );
  }

  const env = {};

  for (const key of requiredVars) {
    env[key] = process.env[key];
  }

  for (const key of optionalVars) {
    env[key] = process.env[key] || null;
  }

  return Object.freeze(env);
}

export const env = validateEnv();
