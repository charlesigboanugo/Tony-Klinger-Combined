import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Customer entitlement checks for the storefront — note 03 §5, note 07 §28.
 *
 * A public product page is public, but it is not identical for everyone. A
 * customer who already holds covering entitlement must be offered the delivery
 * route, not asked to buy the same thing twice: note 01 §11 forbids charging
 * again for access already granted.
 */
export type EntitlementState =
  | { state: "none" }
  | { state: "active"; expiresAt: string | null; remaining: number | null }
  | { state: "expired"; expiredAt: string | null };

export type ResourceType =
  | "course"
  | "group_coaching_series"
  | "group_coaching_session"
  | "cohort"
  | "retreat"
  | "event"
  | "masterclass";

/**
 * The caller's entitlement for one resource.
 *
 * RLS scopes this to the signed-in user, so it cannot report on anyone else
 * even if called with the wrong arguments (note 08 §59).
 */
export async function entitlementFor(
  resourceType: ResourceType,
  resourceId?: string | null,
): Promise<EntitlementState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "none" };

  let query = supabase
    .from("entitlements")
    .select("status,expires_at,quantity,quantity_used")
    .eq("resource_type", resourceType);

  // A membership-derived entitlement may cover a whole resource type with a
  // null resource_id, so match the specific row OR the blanket one.
  if (resourceId) {
    query = query.or(`resource_id.eq.${resourceId},resource_id.is.null`);
  }

  const { data } = await query;
  const rows = data ?? [];
  if (rows.length === 0) return { state: "none" };

  const now = Date.now();
  const active = rows.find(
    (r) =>
      r.status === "active" &&
      (!r.expires_at || +new Date(r.expires_at) > now) &&
      (r.quantity == null || (r.quantity_used ?? 0) < r.quantity),
  );

  if (active) {
    return {
      state: "active",
      expiresAt: active.expires_at,
      remaining:
        active.quantity == null
          ? null
          : active.quantity - (active.quantity_used ?? 0),
    };
  }

  const lapsed = rows.find((r) => r.status === "expired" || r.expires_at);
  return { state: "expired", expiredAt: lapsed?.expires_at ?? null };
}
