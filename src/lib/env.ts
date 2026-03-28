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
] as const;

const OPTIONAL_VARS = [
  "REDIS_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
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

  // Log optional var status in development
  if (process.env.NODE_ENV !== "production") {
    for (const key of OPTIONAL_VARS) {
      if (!process.env[key]) {
        console.info(`INFO: Optional env var ${key} is not set.`);
      }
    }
  }
}
