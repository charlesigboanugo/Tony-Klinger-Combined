import "server-only";

import { z } from "zod";

/**
 * Server-only environment.
 *
 * The `server-only` import makes this file a build error if it is ever pulled
 * into a Client Component, which is the mechanism that keeps these secrets off
 * the browser (note 09 §49, note 08 §61).
 *
 * Values are validated lazily so that a missing integration secret does not
 * break unrelated pages during local development — the failure surfaces when
 * the integration is actually used.
 */
const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  BREVO_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
});

type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${z.prettifyError(parsed.error)}`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Read a single server secret without requiring every other one to be set. */
export function requireServerEnv<K extends keyof ServerEnv>(
  key: K,
): ServerEnv[K] {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${key}`);
  }
  return value as ServerEnv[K];
}
