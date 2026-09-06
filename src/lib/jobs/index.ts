import "server-only";

import { issueClaimToken } from "@/lib/commerce/claim";
import { recordCustomer, syncAudiences } from "@/lib/email/audience";
import { dispatchPendingEmails, queueEmail } from "@/lib/email/send";
import { stripe } from "@/lib/stripe/client";
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
      const session = await stripe().checkout.sessions.retrieve(order.external_reference);

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
        const result = fulfilment as { claimed?: boolean } | null;
        const email = session.customer_details?.email ?? session.customer_email;

        if (result && result.claimed === false) {
          const claim = await issueClaimToken(order.id);
          if (claim && email) {
            if (
              await queueEmail({
                idempotencyKey: `claim:${order.id}`,
                template: "guest_claim",
                to: email,
                payload: { claimUrl: claim.url, expiresAt: claim.expiresAt },
              })
            ) {
              notified += 1;
            }
          }
        } else if (email) {
          // Soft opt-in, exactly as on the webhook path: the details were
          // obtained in the course of a sale, and addToList still skips anyone
          // who has unsubscribed.
          await recordCustomer(email);

          // False means the key was already used — the webhook got there first.
          // Counting that as a notification would overstate what this run did.
          if (
            await queueEmail({
              idempotencyKey: `receipt:${order.id}`,
              template: "order_receipt",
              to: email,
              payload: {
                total: session.amount_total ?? 0,
                currency: (session.currency ?? "gbp").toUpperCase(),
              },
            })
          ) {
            notified += 1;
          }
        }
      } else {
        // Left pending on purpose. An unpaid order is not a problem to fix; it
        // is a customer who did not finish (note 09 §45).
        summary.stillUnpaid += 1;
      }
    } catch (caught) {
      summary.errors.push(
        `${order.id}: ${caught instanceof Error ? caught.message : "unknown"}`,
      );
    }
  }

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

export const JOBS = {
  "sync-stripe": syncCatalogueToStripe,
  "send-emails": sendPendingEmails,
  "expire-entitlements": expireEntitlements,
  "cleanup-tokens": cleanupTokens,
  "reconcile-stripe": reconcileStripeOrders,
  "sync-audiences": syncMarketingAudiences,
} as const;

export type JobName = keyof typeof JOBS;
