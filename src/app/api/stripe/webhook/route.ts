import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";

import { issueClaimToken } from "@/lib/commerce/claim";
import { recordCustomer, recordMember, removeMember } from "@/lib/email/audience";
import { queueEmail } from "@/lib/email/send";
import { requireServerEnv } from "@/lib/env/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook — note 09 §19–§23.
 *
 * This is the ONLY place a payment becomes access. A customer returning to
 * /checkout/success proves nothing: they may have closed the tab, or never
 * paid at all (note 09 §3, §23).
 *
 * Three properties this handler must have:
 *
 *   1. Verified   — the signature is checked before anything is read.
 *   2. Idempotent — providers redeliver; replay must not double-grant.
 *   3. Recoverable — a failure returns non-2xx so Stripe retries, and the
 *      order remains identifiable for reconciliation (note 09 §57).
 *
 * Runs with the service role because the payer usually has no session here —
 * the request comes from Stripe, not a browser.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // The RAW body is required: any parsing or re-encoding changes the bytes and
  // invalidates the signature.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      payload,
      signature,
      requireServerEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch {
    // Unverified: never trust it, never say why (note 09 §20).
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency gate. The unique constraint is what makes this safe under
  // concurrent redelivery — two simultaneous copies cannot both insert
  // (note 09 §21, note 08 §65).
  const { error: seenError } = await admin
    .from("processed_webhook_events")
    .insert({ provider: "stripe", event_id: event.id });

  if (seenError) {
    // Already processed. Acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event, admin);
  } catch (error) {
    // Roll back the idempotency marker so a retry can genuinely reprocess,
    // rather than being swallowed as a duplicate.
    await admin
      .from("processed_webhook_events")
      .delete()
      .eq("provider", "stripe")
      .eq("event_id", event.id);

    console.error("stripe webhook failed", {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : "unknown",
    });

    // Non-2xx asks Stripe to retry (note 09 §47).
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleEvent(event: Stripe.Event, admin: AdminClient) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Our own order id, put there when the session was created — never a
      // value supplied by the browser (note 09 §14).
      const orderId = session.metadata?.order_id;
      if (!orderId) return;

      if (session.payment_status !== "paid") return;

      const { data, error } = await admin.rpc("fulfil_order", {
        p_order_id: orderId,
        p_provider_payment_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? session.id),
        p_amount: session.amount_total ?? null,
      });

      if (error) throw new Error(`fulfil_order failed: ${error.message}`);

      // A guest order is paid but has no owner yet, so it has no entitlements
      // either. Issue the single-use claim token that links it to an account
      // (note 05 §29.3). The order stays valid indefinitely in the meantime —
      // it is never treated as an abandoned cart (note 09 §45).
      const result = data as { claimed?: boolean } | null;
      const email = session.customer_details?.email ?? session.customer_email;

      if (result && result.claimed === false) {
        const claim = await issueClaimToken(orderId);
        if (claim && email) {
          // The claim link IS the credential, so it goes only to the address
          // that paid (note 05 §29.3). Queued rather than sent inline: a
          // provider outage must not fail the webhook and trigger a Stripe
          // retry of an order already fulfilled (note 09 §42).
          await queueEmail({
            idempotencyKey: `claim:${orderId}`,
            template: "guest_claim",
            to: email,
            payload: { claimUrl: claim.url, expiresAt: claim.expiresAt },
          });
        }
      } else if (email) {
        // Soft opt-in: details obtained in the course of a sale. The opt-out
        // shown at checkout and in every message is what makes this lawful, and
        // addToList skips anyone who has since unsubscribed.
        await recordCustomer(email);

        await queueEmail({
          idempotencyKey: `receipt:${orderId}`,
          template: "order_receipt",
          to: email,
          payload: {
            total: session.amount_total ?? 0,
            currency: (session.currency ?? "gbp").toUpperCase(),
          },
        });
      }
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (!userId) return;

      // Written only when Stripe carries a tier we recognise. An unrecognised
      // string would fail the enum cast, return non-2xx, and put Stripe into a
      // retry loop over a subscription that could never be stored — so it is
      // dropped rather than trusted (note 09 §14).
      const tier = MEMBERSHIP_TIERS.find(
        (t) => t === subscription.metadata?.membership_tier,
      );

      // In API version 2026-08-26.dahlia the billing period lives on the
      // subscription ITEM, not on the subscription. Reading it from the
      // subscription returns undefined and silently stores a null period.
      const item = subscription.items?.data?.[0];
      const toIso = (seconds: number | null | undefined) =>
        seconds ? new Date(seconds * 1000).toISOString() : null;

      const { data: row, error } = await admin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "stripe",
            provider_subscription_id: subscription.id,
            status: mapSubscriptionStatus(subscription.status),
            current_period_start: toIso(item?.current_period_start),
            current_period_end: toIso(item?.current_period_end),
            cancel_at: toIso(subscription.cancel_at),
            // Omitted rather than nulled on an update, so a tier already
            // recorded is not wiped by an event that omits the metadata.
            ...(tier ? { membership_tier: tier } : {}),
          },
          { onConflict: "provider,provider_subscription_id" },
        )
        .select("membership_tier,current_period_end")
        .single();

      if (error) throw new Error(`subscription upsert failed: ${error.message}`);

      // Looked up once and used for both the announcement and the list sync.
      const { data: account } = await admin.auth.admin.getUserById(userId);
      const email = account?.user?.email;

      // MEMBERS IS DYNAMIC — it has to shrink as well as grow, or somebody who
      // cancelled keeps receiving "your Gold benefits" months later.
      //
      // Customers is deliberately untouched here. Soft opt-in rests on having
      // BOUGHT, not on still subscribing, so a lapsed member remains a customer
      // and stays on that list.
      if (email) {
        if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
          await recordMember(email, row?.membership_tier ?? null);
        } else {
          await removeMember(email);
        }
      }

      // Only on creation. An `updated` event fires for every renewal and every
      // card change, and none of those is a new membership to announce.
      if (
        event.type === "customer.subscription.created" &&
        ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
      ) {
        if (email) {
          await queueEmail({
            // Keyed to the subscription, so a redelivered `created` event —
            // which Stripe may send more than once — announces it only once.
            idempotencyKey: `membership:${subscription.id}`,
            template: "membership_activated",
            to: email,
            payload: {
              tier_name: row?.membership_tier
                ? `${row.membership_tier} membership`
                : "membership",
              renews_at: row?.current_period_end ?? null,
            },
          });
        }
      }
      return;
    }

    case "invoice.payment_failed": {
      // Access is not removed here. A failed renewal follows the configured
      // grace-period policy rather than an immediate cut-off (note 09 §17, §24).
      return;
    }

    default:
      return;
  }
}

/**
 * Membership tiers, as stored. Kept as a literal list rather than derived from
 * the generated types so an unrecognised value from Stripe is filtered out here
 * instead of failing an enum cast inside the database.
 */
const MEMBERSHIP_TIERS = ["silver", "gold", "platinum", "ultimate"] as const;

/**
 * Subscription states that mean the person actually has the membership.
 *
 * `incomplete` in particular does NOT — the first payment has not settled, and
 * announcing a membership that may never activate is worse than announcing it
 * a few seconds late when the `updated` event follows.
 */
const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
]);

/** Stripe's vocabulary is not ours; map rather than store theirs. */
function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "expired";
  }
}
