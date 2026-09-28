import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";

import { issueClaimToken } from "@/lib/commerce/claim";
import { recordCustomer, recordMember, removeMember } from "@/lib/email/audience";
import { queueEmail } from "@/lib/email/send";
import { requireServerEnv } from "@/lib/env/server";
import { stripe } from "@/lib/stripe/client";
import { rememberCustomer } from "@/lib/stripe/customer";
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

      await recordReceipt(session, orderId, admin);

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

    case "checkout.session.expired": {
      // An unpaid private coaching checkout gives its held time back now
      // rather than when the hold lapses (migration 0020). Nothing else is
      // held against a checkout, so for every other order this is a no-op.
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (!orderId) return;

      const { error } = await admin.rpc("release_private_coaching_hold", { p_order_id: orderId });
      if (error) throw new Error(`release_private_coaching_hold failed: ${error.message}`);
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
            // "Cancel at the end of the period" (the Customer Portal's
            // default) is shown to the customer as a state, not a guess.
            cancel_at: toIso(
              subscription.cancel_at ??
                (subscription.cancel_at_period_end ? item?.current_period_end : null),
            ),
            cancel_at_period_end: subscription.cancel_at_period_end || subscription.cancel_at != null,
            // Omitted rather than nulled on an update, so a tier already
            // recorded is not wiped by an event that omits the metadata.
            ...(tier ? { membership_tier: tier } : {}),
          },
          { onConflict: "provider,provider_subscription_id" },
        )
        .select("id,membership_tier,current_period_end")
        .single();

      if (error) throw new Error(`subscription upsert failed: ${error.message}`);

      // Invoices that arrived before this subscription row existed.
      if (row) {
        await admin
          .from("invoices")
          .update({ subscription_id: row.id })
          .eq("provider_subscription_id", subscription.id)
          .is("subscription_id", null);
      }

      // Members who subscribed before customers were stored get theirs now.
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
      if (customerId) await rememberCustomer(userId, customerId);

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

    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.finalized":
    case "invoice.voided": {
      // Recorded for the billing page's history and receipts (migration 0021).
      // Access is NOT changed here: a failed renewal follows the grace-period
      // policy rather than an immediate cut-off (note 09 §17, §24), and the
      // subscription events carry the status that matters.
      await recordInvoice(event.data.object as Stripe.Invoice, admin);
      return;
    }

    default:
      return;
  }
}

/**
 * Keep Stripe's hosted receipt for a one-off payment, and the buyer's Stripe
 * Customer. A failure here must not fail fulfilment (the order is already
 * paid and access granted): the order page fetches a missing receipt later.
 */
async function recordReceipt(session: Stripe.Checkout.Session, orderId: string, admin: AdminClient) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) {
    const { data: order } = await admin.from("orders").select("user_id").eq("id", orderId).maybeSingle();
    if (order?.user_id) await rememberCustomer(order.user_id, customerId);
  }

  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) return; // A subscription checkout is receipted by its invoice.

  try {
    const intent = await stripe().paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | null;
    if (charge?.receipt_url) {
      await admin
        .from("payments")
        .update({ receipt_url: charge.receipt_url })
        .eq("provider", "stripe")
        .eq("provider_payment_id", intentId);
    }
  } catch (error) {
    console.error("receipt lookup failed", { orderId, message: error instanceof Error ? error.message : "unknown" });
  }
}

/**
 * Upsert a subscription invoice. The owner comes from the subscription's
 * metadata (set at checkout), falling back to the stored customer.
 */
async function recordInvoice(invoice: Stripe.Invoice, admin: AdminClient) {
  const details = invoice.parent?.subscription_details ?? null;
  if (!details) return; // Only subscription invoices are recorded here.

  const providerSubscriptionId = typeof details.subscription === "string" ? details.subscription : details.subscription.id;
  const metadata = details.metadata ?? {};
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  let userId: string | null = metadata.user_id ?? null;
  if (!userId && customerId) {
    const { data } = await admin
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) return; // Not one of ours (or not yet linked); nothing to show anyone.

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle();

  const toIso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);
  const line = invoice.lines?.data?.[0];

  const { error } = await admin.from("invoices").upsert(
    {
      user_id: userId,
      subscription_id: sub?.id ?? null,
      // The first invoice pays the checkout order; renewals have none.
      order_id: invoice.billing_reason === "subscription_create" ? (metadata.order_id ?? null) : null,
      provider: "stripe",
      provider_invoice_id: invoice.id,
      provider_subscription_id: providerSubscriptionId,
      membership_tier: MEMBERSHIP_TIERS.find((t) => t === metadata.membership_tier) ?? null,
      number: invoice.number,
      status: invoice.status ?? "draft",
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: (invoice.currency ?? "gbp").toUpperCase(),
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf: invoice.invoice_pdf ?? null,
      period_start: toIso(line?.period?.start ?? invoice.period_start),
      period_end: toIso(line?.period?.end ?? invoice.period_end),
      paid_at: toIso(invoice.status_transitions?.paid_at),
    },
    { onConflict: "provider,provider_invoice_id" },
  );
  if (error) throw new Error(`invoice upsert failed: ${error.message}`);
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
