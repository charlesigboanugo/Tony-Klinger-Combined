import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting — note 09 §48.
 *
 * Backed by Postgres, not memory. Vercel may run every request in a fresh
 * instance, so an in-memory counter resets constantly and enforces nothing; the
 * database is the only state all invocations share.
 */

/**
 * The caller's address, hashed.
 *
 * `x-forwarded-for` is a chain — `client, proxy1, proxy2` — and the FIRST entry
 * is the original client. It is also trivially spoofable in general, but on
 * Vercel the platform rewrites it, so it is trustworthy in production.
 *
 * The raw address is never stored. It is personal data under GDPR, and a
 * salted hash is enough to count repeat submissions without keeping it.
 */
export async function callerFingerprint(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";

  // Salted with a server secret so the hashes cannot be reversed by trying
  // every possible address — there are only ~4 billion IPv4 addresses, which is
  // minutes of work against an unsalted hash.
  const salt = process.env.CRON_SECRET ?? "local-development-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Consume one unit of an action's budget. Returns true when the caller may
 * proceed.
 *
 * Fails OPEN on a database error: a limiter that is itself broken should not
 * take down the form it protects. The Turnstile check is the other half of the
 * defence and still applies.
 */
export async function checkRateLimit(
  action: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: `${action}:${subject}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("rate limit check failed", { action, message: error.message });
      return true;
    }

    return data === true;
  } catch (error) {
    console.error("rate limit unavailable", {
      action,
      message: error instanceof Error ? error.message : "unknown",
    });
    return true;
  }
}
