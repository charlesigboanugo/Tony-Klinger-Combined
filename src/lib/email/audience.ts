import "server-only";

import { addToList, removeFromList, type ContactResult } from "@/lib/email/contacts";
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
 *
 * AN OPT-OUT MADE ON THE SITE HOLDS TOO (owner, 2026-10-25). Unsubscribing in
 * Account → Notifications is recorded in `marketing_consents`, not in Brevo, so
 * every add here also checks that record (`marketing_opted_out`, migration
 * 0024). Before this, the next purchase or the daily sync put them back.
 */

/** How far back the daily sync retries list changes that failed at the time. */
const RETRY_DAYS = 7;

/** Soft opt-in shown under the checkout button, stored with the buyer's row. */
const CHECKOUT_NOTICE =
  "We may email you occasional news about similar coaching, courses and events. Every email has an unsubscribe link, and you can opt out at any time in your notification settings.";

/** Sources where the person asked for news themselves (explicit opt-in). */
const NEWSLETTER_SOURCES = new Set(["newsletter_form", "account_settings", "import"]);

/**
 * Whether the site holds this address as opted out. FAIL CLOSED, as
 * `isUnsubscribed` in contacts.ts does: if we cannot tell, we do not add them.
 */
async function optedOut(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("marketing_opted_out", { p_email: email });
  if (error) {
    console.error("opt-out lookup failed; treating as opted out", { message: error.message });
    return true;
  }
  return data === true;
}

/**
 * Called when an order is fulfilled. Soft opt-in — see the note above.
 *
 * The buyer's 'checkout' consent row is written first, so Account →
 * Notifications shows them as subscribed and can take them off, and so the
 * daily sync can retry the Brevo add if it fails here. Somebody who opted out
 * gets no row and is not added.
 */
export async function recordCustomer(
  email: string,
  attributes?: Record<string, unknown>,
): Promise<void> {
  const { data: allowed, error } = await createAdminClient().rpc("record_soft_opt_in", {
    p_email: email,
    p_consent_text: CHECKOUT_NOTICE,
    p_consent_url: "/checkout",
  });
  if (error) {
    // Never thrown: a list sync failing must not fail the purchase that
    // triggered it.
    console.error("soft opt-in record failed", { message: error.message });
    return;
  }
  if (allowed !== true) return;

  const result = await addToList("customers", email, attributes);
  if (!result.ok) {
    // The daily sync retries it from the consent row.
    console.error("customer list sync failed", { error: result.error });
  }
}

/** Called when a subscription becomes active. */
export async function recordMember(
  email: string,
  tier?: string | null,
): Promise<void> {
  if (await optedOut(email)) return;

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

/** Called when somebody unsubscribes on the site: off every list we own. */
export async function removeFromAllLists(email: string): Promise<boolean> {
  let ok = true;
  for (const list of ["newsletter", "customers", "members"] as const) {
    const result = await removeFromList(list, email);
    if (!result.ok) {
      ok = false;
      console.error("list removal failed", { list, error: result.error });
    }
  }
  return ok;
}

export type AudienceSyncResult = {
  membersAdded: number;
  membersRemoved: number;
  newsletterAdded: number;
  customersAdded: number;
  optOutsRemoved: number;
  failed: number;
};

type ConsentRow = { email: string; source: string; granted_at: string; withdrawn_at: string | null };

/** Every consent row for these addresses, grouped by address. */
async function consentsFor(emails: string[]): Promise<Map<string, ConsentRow[]>> {
  const byEmail = new Map<string, ConsentRow[]>();
  if (emails.length === 0) return byEmail;

  const { data, error } = await createAdminClient()
    .from("marketing_consents")
    .select("email,source,granted_at,withdrawn_at")
    .in("email", emails);
  if (error) throw new Error(`marketing_consents failed: ${error.message}`);

  for (const row of (data ?? []) as ConsentRow[]) {
    byEmail.set(row.email, [...(byEmail.get(row.email) ?? []), row]);
  }
  return byEmail;
}

/** Opted out = has consent rows and none of them is live (as migration 0024). */
const isOptedOut = (rows: ConsentRow[] | undefined) =>
  !!rows && rows.length > 0 && rows.every((r) => r.withdrawn_at);

/**
 * Reconcile the lists against the database.
 *
 * Reconciliation rather than event-driven only, because Vercel Cron does not
 * retry and a webhook can be missed: a membership that lapsed while an event
 * was lost would otherwise keep receiving member email indefinitely. This runs
 * on a schedule and converges regardless of what was missed.
 *
 *   Members      everyone with an active subscription, unless opted out
 *   Newsletter   and Customers: consents given or refreshed in the last
 *                RETRY_DAYS, so an add that failed at the time is retried
 *   Opt-outs     made in the last RETRY_DAYS: off every list again, in case
 *                the removal at the time failed
 */
export async function syncAudiences(): Promise<AudienceSyncResult> {
  const admin = createAdminClient();
  const result: AudienceSyncResult = {
    membersAdded: 0,
    membersRemoved: 0,
    newsletterAdded: 0,
    customersAdded: 0,
    optOutsRemoved: 0,
    failed: 0,
  };

  const count = (outcome: ContactResult, added: "membersAdded" | "newsletterAdded" | "customersAdded") => {
    if (outcome.ok) {
      if (!outcome.skipped) result[added] += 1;
    } else {
      result.failed += 1;
      console.error("audience sync failed", { list: added, error: outcome.error });
    }
  };

  const { data: active, error } = await admin
    .from("active_member_emails")
    .select("email,membership_tier");

  if (error) throw new Error(`active_member_emails failed: ${error.message}`);

  const members = (active ?? []) as Array<{ email: string; membership_tier: string | null }>;
  const memberConsents = await consentsFor(members.map((m) => m.email.toLowerCase()));

  for (const row of members) {
    if (isOptedOut(memberConsents.get(row.email.toLowerCase()))) continue;
    count(
      await addToList(
        "members",
        row.email,
        row.membership_tier ? { TIER: row.membership_tier } : undefined,
      ),
      "membersAdded",
    );
  }

  // Removing lapsed members is deliberately NOT done by diffing Brevo's list
  // against this view. That would require reading the whole list and would
  // remove anybody added by hand from the dashboard. Removal is event-driven,
  // from the subscription webhook, where the specific person is known.

  const since = new Date(Date.now() - RETRY_DAYS * 86_400_000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("marketing_consents")
    .select("email")
    .or(`granted_at.gte.${since},withdrawn_at.gte.${since}`);
  if (recentError) throw new Error(`marketing_consents failed: ${recentError.message}`);

  const recentEmails = [...new Set((recent ?? []).map((r) => (r as { email: string }).email))];
  const consents = await consentsFor(recentEmails);

  for (const email of recentEmails) {
    const rows = consents.get(email) ?? [];

    if (isOptedOut(rows)) {
      if (rows.some((r) => r.withdrawn_at && r.withdrawn_at >= since)) {
        if (await removeFromAllLists(email)) result.optOutsRemoved += 1;
        else result.failed += 1;
      }
      continue;
    }

    const live = rows.filter((r) => !r.withdrawn_at && r.granted_at >= since);
    if (live.some((r) => NEWSLETTER_SOURCES.has(r.source))) {
      count(await addToList("newsletter", email), "newsletterAdded");
    }
    if (live.some((r) => r.source === "checkout")) {
      count(await addToList("customers", email), "customersAdded");
    }
  }

  return result;
}
