import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/urls";

/**
 * Guest order claim tokens — note 05 §29.3.
 *
 * The token is generated server-side, sent to the address that paid, and
 * stored only as a SHA-256 hash. A database dump therefore yields no usable
 * tokens, and neither does a log line.
 *
 * Redeeming requires the token AND an authenticated session. An email address
 * alone is never sufficient: the payer and the account holder are not
 * necessarily the same person.
 */

const TOKEN_BYTES = 32;
const TTL_HOURS = 72;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a claim token for a paid, unclaimed order.
 *
 * Returns the raw token exactly once — it is never recoverable afterwards.
 */
export async function issueClaimToken(
  orderId: string,
): Promise<{ token: string; url: string; expiresAt: string } | null> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id,user_id,status")
    .eq("id", orderId)
    .maybeSingle();

  // Only unclaimed orders need a token; an owned order already has its access.
  if (!order || (order as { user_id: string | null }).user_id) return null;

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600_000).toISOString();

  const { error } = await admin.from("order_claim_tokens").insert({
    order_id: orderId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });

  if (error) return null;

  return {
    token,
    url: absoluteUrl(`/account/claim?token=${encodeURIComponent(token)}`),
    expiresAt,
  };
}
