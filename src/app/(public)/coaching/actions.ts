"use server";

import { entitlementFor, type EntitlementState } from "@/lib/commerce/entitlements";

const OWNABLE = ["course", "cohort", "group_coaching_series"] as const;
type Ownable = (typeof OWNABLE)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What the visitor already holds for one product page — note 03 §5.
 *
 * Asked by the page after it loads, because the page itself is pre-built and
 * the same for everyone (note 10 §47.1). The id reaches a PostgREST filter, so
 * it is checked to be a UUID; RLS still limits the answer to the caller.
 */
export async function viewerEntitlementAction(
  resourceType: string,
  resourceId: string,
): Promise<EntitlementState> {
  if (!OWNABLE.includes(resourceType as Ownable) || !UUID.test(resourceId)) {
    return { state: "none" };
  }
  return entitlementFor(resourceType as Ownable, resourceId);
}
