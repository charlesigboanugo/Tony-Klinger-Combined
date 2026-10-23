import "server-only";

import { notifyPaidOrder } from "@/lib/commerce/notify";
import { cancelUnfinishedOrder } from "@/lib/commerce/orders";
import { syncAudiences } from "@/lib/email/audience";
import { dispatchPendingEmails, queueEmail } from "@/lib/email/send";
import { stripe } from "@/lib/stripe/client";
import { cleanupAbandonedUploads } from "@/lib/storage/remove";
import { syncCatalogueToStripe } from "@/lib/stripe/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled operations — note 01 §18, note 09 §44.
 *
 * The work lives here, not in the route, so the same operation can be run by a
 * schedule, an admin action or a manual reconciliation without being written
 * twice. Each is idempotent and safely re-runnable: a schedule can fire twice,
 * overlap itself, or retry after a failure.
 */

export async function expireEntitlements() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_lapsed_entitlements");
  if (error) throw new Error(`expire_lapsed_entitlements: ${error.message}`);
  return data;
}

export async function cleanupTokens() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cleanup_expired_tokens");
  if (error) throw new Error(`cleanup_expired_tokens: ${error.message}`);
  return data;
}

export async function sendPendingEmails() {
  return dispatchPendingEmails(25);
}

/**
 * Reconcile orders against Stripe — note 09 §46.
 *
 * A webhook can be delayed, dropped, or fail while our side is briefly down.
 * This asks Stripe for the authoritative state of orders that look stuck, and
 * fulfils the ones Stripe says were paid.
 *
 * Fulfilment runs through the same `fulfil_order` used by the webhook, so a
 * reconciled order is indistinguishable from a normally processed one — and
 * because that function is idempotent, racing the late webhook is harmless.
 */
export async function reconcileStripeOrders() {
  const admin = createAdminClient();
  const summary = {
    checked: 0,
    fulfilled: 0,
    notified: 0,
    stillUnpaid: 0,
    /** Payment page expired unpaid, or gone from Stripe: marked "Not completed". */
    closed: 0,
    errors: [] as string[],
  };

  const { data, error } = await admin.rpc("orders_awaiting_reconciliation", {
    p_older_than: "15 minutes",
  });
  if (error) throw new Error(`orders_awaiting_reconciliation: ${error.message}`);

  const orders = (data ?? []) as Array<{ id: string; external_reference: string | null }>;
  let notified = 0;

  for (const order of orders) {
    if (!order.external_reference) continue;
    summary.checked += 1;

    try {
      const session = await stripe()
        .checkout.sessions.retrieve(order.external_reference)
        .catch((caught: unknown) => {
          // A session Stripe no longer has (a test-mode reset, a deleted
          // account) can never be paid. Anything else is a real failure.
          if ((caught as { code?: string }).code === "resource_missing") return null;
          throw caught;
        });

      if (!session) {
        if (await cancelUnfinishedOrder(order.id)) summary.closed += 1;
        continue;
      }

      if (session.payment_status === "paid") {
        const { data: fulfilment, error: fulfilError } = await admin.rpc("fulfil_order", {
          p_order_id: order.id,
          p_provider_payment_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? session.id),
          p_amount: session.amount_total ?? null,
        });
        if (fulfilError) throw new Error(fulfilError.message);
        summary.fulfilled += 1;

        // AN ORDER RECOVERED HERE MUST STILL BE ACKNOWLEDGED.
        //
        // This path exists precisely because the webhook did not arrive, so if
        // the notifications only lived there, a customer whose webhook was lost
        // would be charged, granted access, and told nothing.
        //
        // THE IDEMPOTENCY KEYS ARE IDENTICAL TO THE WEBHOOK'S. That is what
        // makes running both safe: whichever path reaches `enqueue_email`
        // first wins, and a webhook arriving late finds the key already used
        // and queues nothing. Changing a key here would start sending two of
        // every receipt.
        notified += await notifyPaidOrder(order.id, session, (fulfilment as { claimed?: boolean } | null)?.claimed);
      } else if (session.status === "expired") {
        // The payment page closed unpaid. The webhook does this as it happens;
        // this catches one it missed, so no unfinished order stays pending and
        // keeps its place in this job's hundred (owner, 2026-10-23).
        if (await cancelUnfinishedOrder(order.id)) summary.closed += 1;
      } else {
        // Still open: the customer has up to 24 hours to finish (note 09 §45).
        summary.stillUnpaid += 1;
      }
    } catch (caught) {
      summary.errors.push(
        `${order.id}: ${caught instanceof Error ? caught.message : "unknown"}`,
      );
    }
  }

  /*
    AN ORDER WHOSE PAYMENT PAGE WAS NEVER MADE (Stripe unreachable at that
    moment; checkout told them to try again). It has no session to ask about,
    so the loop above never sees it. A day on, it is closed as well.
  */
  const { data: orphaned, error: orphanError } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .is("external_reference", null)
    .lt("created_at", new Date(Date.now() - 24 * 3_600_000).toISOString())
    .select("id");
  if (orphanError) summary.errors.push(`orders without a session: ${orphanError.message}`);
  summary.closed += (orphaned ?? []).length;

  summary.notified = notified;
  return summary;
}

/** The registry the cron route dispatches on. */
/**
 * Reconcile the Members list against active subscriptions.
 *
 * Event-driven syncing from the webhook is the primary path; this catches what
 * that misses, because Vercel Cron does not retry and a webhook can be dropped.
 * Without it, a membership that lapsed during a lost event would keep receiving
 * member-only email indefinitely.
 */
async function syncMarketingAudiences() {
  return syncAudiences();
}

/**
 * Event reminders — migration 0018.
 *
 * Every live ticket gets one reminder in the day before its event, and every
 * online or hybrid ticket gets the joining link again in the hour before the
 * start. Each message is keyed on the booking and its kind, so a run that
 * repeats, overlaps or catches up after a missed schedule sends nothing twice.
 */
export async function sendEventReminders() {
  const admin = createAdminClient();
  const summary = { dayBefore: 0, starting: 0 };

  for (const kind of ["day_before", "starting"] as const) {
    const { data, error } = await admin.rpc("event_reminders_due", { p_kind: kind });
    if (error) throw new Error(`event_reminders_due(${kind}): ${error.message}`);

    for (const row of data ?? []) {
      const queued = await queueEmail({
        idempotencyKey: `event-${kind}:${row.booking_id}`,
        template: kind === "day_before" ? "event_reminder" : "event_starting",
        to: row.email,
        payload: {
          bookingId: row.booking_id,
          reference: row.reference,
          title: row.title,
          startsAt: row.starts_at,
          location: row.location,
          venueAddress: row.format === "online" ? null : row.venue_address,
          // The link only for tickets that join online.
          joinUrl: row.format === "in_person" || !/^https?:\/\//i.test(row.join_url ?? "") ? null : row.join_url,
          joiningNotes: row.joining_notes,
        },
      });
      if (queued) summary[kind === "day_before" ? "dayBefore" : "starting"] += 1;
    }
  }

  return summary;
}

/**
 * Coaching session reminders — migration 0017.
 *
 * Group Coaching, private sessions, cohort workshops, the members' Q&A and
 * retreats, on the same two moments as events: a reminder in the day before,
 * and the joining link again in the hour before the start (only when the
 * session has one). Who gets each is the database's (`session_reminders_due`),
 * matching who can open the session in the Academy. Keyed per kind, session
 * and person, so nothing is sent twice.
 */
export async function sendSessionReminders() {
  const admin = createAdminClient();
  const summary = { dayBefore: 0, starting: 0 };

  for (const when of ["day_before", "starting"] as const) {
    const { data, error } = await admin.rpc("session_reminders_due", { p_kind: when });
    if (error) throw new Error(`session_reminders_due(${when}): ${error.message}`);

    for (const row of data ?? []) {
      const queued = await queueEmail({
        idempotencyKey: `session-${when}:${row.kind}:${row.item_id}:${row.user_id}`,
        template: when === "day_before" ? "session_reminder" : "session_starting",
        to: row.email,
        payload: {
          kind: row.kind,
          title: row.title,
          groupName: row.group_name,
          groupSlug: row.group_slug,
          startsAt: row.starts_at,
          joinUrl: row.join_url,
          notes: row.notes,
        },
      });
      if (queued) summary[when === "day_before" ? "dayBefore" : "starting"] += 1;
    }
  }

  return summary;
}

/**
 * "Your pass ends soon" — migration 0017.
 *
 * A Coaching Pass is one payment for twelve months and does not renew, so the
 * holder is told twice: about a month before (when buying the next year opens)
 * and in the last week. A holder who has already bought the next year, or whose
 * pass is on a renewing subscription, is left out by `passes_ending_due`.
 */
export async function sendPassReminders() {
  const admin = createAdminClient();
  const summary = { month: 0, week: 0 };

  for (const when of ["month", "week"] as const) {
    const { data, error } = await admin.rpc("passes_ending_due", { p_kind: when });
    if (error) throw new Error(`passes_ending_due(${when}): ${error.message}`);

    for (const row of data ?? []) {
      const queued = await queueEmail({
        idempotencyKey: `pass-ending-${when}:${row.entitlement_id}:${row.expires_at}`,
        template: "pass_ending",
        to: row.email,
        payload: { tierName: row.tier_name, expiresAt: row.expires_at },
      });
      if (queued) summary[when] += 1;
    }
  }

  return summary;
}

export const JOBS = {
  "sync-stripe": syncCatalogueToStripe,
  "send-emails": sendPendingEmails,
  "expire-entitlements": expireEntitlements,
  "cleanup-tokens": cleanupTokens,
  "cleanup-uploads": cleanupAbandonedUploads,
  "reconcile-stripe": reconcileStripeOrders,
  "sync-audiences": syncMarketingAudiences,
  "event-reminders": sendEventReminders,
  "session-reminders": sendSessionReminders,
  "pass-reminders": sendPassReminders,
} as const;

export type JobName = keyof typeof JOBS;
