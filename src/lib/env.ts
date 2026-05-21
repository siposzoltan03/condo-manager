/**
 * Environment variable validation.
 *
 * Call `validateEnv()` at application startup to ensure all required
 * environment variables are present. In development, missing variables
 * produce a warning; in production, the process exits.
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "BALLOT_SECRET",
] as const;

const OPTIONAL_VARS = [
  "REDIS_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;

    if (process.env.NODE_ENV === "production") {
      console.error(`FATAL: ${message}`);
      process.exit(1);
    } else {
      console.warn(`WARNING: ${message}`);
    }
  }

  // Validate secret strength + reject the placeholder value.
  const PLACEHOLDER_SECRETS = new Set([
    "your-secret-key-change-in-production",
    "change-me",
    "secret",
  ]);

  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.length < 32) {
    const msg = "NEXTAUTH_SECRET must be at least 32 characters. Generate with: openssl rand -base64 32";
    if (process.env.NODE_ENV === "production") {
      console.error(`FATAL: ${msg}`);
      process.exit(1);
    } else {
      console.warn(`WARNING: ${msg}`);
    }
  }
  if (secret && PLACEHOLDER_SECRETS.has(secret)) {
    const msg =
      "NEXTAUTH_SECRET is set to a known placeholder value. Replace it with a fresh random secret.";
    if (process.env.NODE_ENV === "production") {
      console.error(`FATAL: ${msg}`);
      process.exit(1);
    } else {
      console.warn(`WARNING: ${msg}`);
    }
  }

  // Same checks for BALLOT_SECRET — vote receipts are forgeable if this is
  // weak or default.
  const ballot = process.env.BALLOT_SECRET;
  if (ballot && ballot.length < 32) {
    const msg = "BALLOT_SECRET must be at least 32 characters.";
    if (process.env.NODE_ENV === "production") {
      console.error(`FATAL: ${msg}`);
      process.exit(1);
    } else {
      console.warn(`WARNING: ${msg}`);
    }
  }
  if (
    ballot &&
    (PLACEHOLDER_SECRETS.has(ballot) || ballot === "default-ballot-secret")
  ) {
    const msg =
      "BALLOT_SECRET is a known placeholder. Vote receipts would be forgeable.";
    if (process.env.NODE_ENV === "production") {
      console.error(`FATAL: ${msg}`);
      process.exit(1);
    } else {
      console.warn(`WARNING: ${msg}`);
    }
  }

  // Log optional var status in development
  if (process.env.NODE_ENV !== "production") {
    for (const key of OPTIONAL_VARS) {
      if (!process.env[key]) {
        console.info(`INFO: Optional env var ${key} is not set.`);
      }
    }
  }
}
