import "server-only";

import { addToList, removeFromList } from "@/lib/email/contacts";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keeping the Customers and Members lists correct — PECR reg 22.
 *
 * TWO LISTS, TWO DIFFERENT RULES, and the difference is legal rather than
 * technical:
 *
 *   CUSTOMERS is APPEND-ONLY. Soft opt-in rests on having BOUGHT, not on
 *   currently holding a subscription. Somebody who bought a course last year is
 *   still a customer, so a lapsed member stays here. Nothing in this module
 *   removes anyone from it.
 *
 *   MEMBERS is DYNAMIC. It reflects who holds an active membership right now,
 *   so it must shrink as well as grow — otherwise "your Gold benefits" goes to
 *   somebody who left months ago.
 *
 * Every add goes through `addToList`, which reads the contact's state first and
 * skips anyone Brevo holds as unsubscribed. That is what stops this reconciler
 * re-adding a person who pressed unsubscribe but is still, quite correctly, in
 * the orders table.
 */

/** Called when an order is fulfilled. Soft opt-in — see the note above. */
export async function recordCustomer(
  email: string,
  attributes?: Record<string, unknown>,
): Promise<void> {
  const result = await addToList("customers", email, attributes);
  if (!result.ok) {
    // Never thrown: a list sync failing must not fail the purchase that
    // triggered it. The nightly reconcile picks it up.
    console.error("customer list sync failed", { error: result.error });
  }
}

/** Called when a subscription becomes active. */
export async function recordMember(
  email: string,
  tier?: string | null,
): Promise<void> {
  const result = await addToList("members", email, tier ? { TIER: tier } : undefined);
  if (!result.ok) {
    console.error("member list sync failed", { error: result.error });
  }
}

/** Called when a subscription ends. Removes from Members ONLY. */
export async function removeMember(email: string): Promise<void> {
  const result = await removeFromList("members", email);
  if (!result.ok) {
    console.error("member list removal failed", { error: result.error });
  }
}

export type AudienceSyncResult = {
  membersAdded: number;
  membersRemoved: number;
  failed: number;
};

/**
 * Reconcile the Members list against the database.
 *
 * Reconciliation rather than event-driven only, because Vercel Cron does not
 * retry and a webhook can be missed: a membership that lapsed while an event
 * was lost would otherwise keep receiving member email indefinitely. This runs
 * on a schedule and converges regardless of what was missed.
 */
export async function syncAudiences(): Promise<AudienceSyncResult> {
  const admin = createAdminClient();
  const result: AudienceSyncResult = {
    membersAdded: 0,
    membersRemoved: 0,
    failed: 0,
  };

  const { data: active, error } = await admin
    .from("active_member_emails")
    .select("email,membership_tier");

  if (error) throw new Error(`active_member_emails failed: ${error.message}`);

  for (const row of (active ?? []) as Array<{
    email: string;
    membership_tier: string | null;
  }>) {
    const outcome = await addToList(
      "members",
      row.email,
      row.membership_tier ? { TIER: row.membership_tier } : undefined,
    );
    if (outcome.ok) {
      if (!outcome.skipped) result.membersAdded += 1;
    } else {
      result.failed += 1;
      console.error("member sync failed", { error: outcome.error });
    }
  }

  // Removing lapsed members is deliberately NOT done by diffing Brevo's list
  // against this view. That would require reading the whole list and would
  // remove anybody added by hand from the dashboard. Removal is event-driven,
  // from the subscription webhook, where the specific person is known.

  return result;
}
