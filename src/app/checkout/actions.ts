"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isBillingPeriod } from "@/lib/commerce/billing";
import { readCart } from "@/lib/commerce/cart";
import { createPendingOrder, priceCart } from "@/lib/commerce/orders";
import { stripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/urls";

/**
 * Start checkout — note 09 §4, §9, §13, §14.
 *
 * Both guest and signed-in checkout are supported (R12). The difference is only
 * who the order points at:
 *
 *   signed in -> user_id from the trusted server session
 *   guest     -> the checkout email, claimed afterwards (note 05 §29.3)
 *
 * Prices are resolved server-side from the database. Nothing about money is
 * taken from the form (note 09 §9).
 */
const schema = z.object({
  /*
    Optional, because checkout serves TWO entry points:

      buy-now   ?membership=… — one product straight from a detail page
      cart      no product    — every line in the customer's cart

    The cart route was previously unreachable: `/checkout` only ever read a
    single slug from the query string, so the cart's own Checkout button led to
    "Nothing to check out" and the whole cart path was dead.
  */
  product: z.string().min(1).optional(),
  // The customer's chosen billing period. Validated as a plain string here and
  // narrowed with isBillingPeriod below, so an unexpected value degrades to
  // monthly rather than rejecting the whole purchase.
  billing: z.string().optional(),
  email: z.email().optional(),
});

export type CheckoutState = { error?: string };

export async function startCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = schema.safeParse({
    product: formData.get("product"),
    billing: formData.get("billing") || undefined,
    email: formData.get("email") || undefined,
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address to continue." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? parsed.data.email;
  if (!email) {
    return { error: "We need an email address to send your receipt." };
  }

  /*
    Buy-now prices the single named product; otherwise the cart is priced in
    full. Either way the AMOUNTS come from the database, never from the form
    (note 09 §9) — the browser only ever names what it wants to buy.
  */
  const requested = parsed.data.product
    ? [
        {
          productSlug: parsed.data.product,
          quantity: 1,
          // Same rule as the page that showed the price (note 09 §16.1).
          billing: isBillingPeriod(parsed.data.billing)
            ? parsed.data.billing
            : ("monthly" as const),
        },
      ]
    : (await readCart()).map((l) => ({
        productSlug: l.slug,
        quantity: l.qty,
        billing: l.billing,
      }));

  const lines = await priceCart(requested);
  if (lines.length === 0) {
    return {
      error: parsed.data.product
        ? "That item is no longer available."
        : "Your cart is empty.",
    };
  }

  /*
    EVENT TICKETS (migration 0018). A ticket is a booking in someone's name, so
    it needs an account at the point of sale — a guest order would leave the
    ticket unissued until claimed, and the door would have nothing to scan.
    One ticket per person per event (the booking's uniqueness rule), and no
    sale once the event is full or has started.
  */
  const tickets = lines.filter((l) => l.productType === "event");
  if (tickets.length > 0) {
    if (!user) {
      return { error: "Please sign in to buy a ticket, so it is issued in your name." };
    }
    if (tickets.some((l) => l.quantity > 1)) {
      return { error: "Tickets are one per person. Each guest can buy their own with their account." };
    }
    for (const line of tickets) {
      const { data: status } = await supabase.rpc("event_sale_status", { p_product_id: line.productId });
      if (status !== "ok") {
        return {
          error:
            status === "full"
              ? `${line.name} is fully booked. You can join its waiting list on the event page.`
              : status === "past"
                ? `${line.name} has already started.`
                : `Tickets for ${line.name} are not on sale just now.`,
        };
      }
    }
  }

  // A RECURRING PRICE MUST USE mode: "subscription".
  //
  // This was previously hard-coded to "payment", so a £15/month membership took
  // £15 once and never renewed — no Stripe subscription existed, so the
  // customer.subscription.* webhooks never fired and no membership entitlement
  // was ever granted.
  const recurring = lines.filter((l) => l.billingType === "recurring");
  const oneOff = lines.filter((l) => l.billingType !== "recurring");

  // Stripe refuses a session mixing the two, and it is not a limitation worth
  // working around: a basket holding a subscription and a book is two different
  // commitments that should be agreed to separately.
  if (recurring.length > 0 && oneOff.length > 0) {
    return {
      error:
        "A subscription has to be bought on its own. Please check out your membership separately from the other items.",
    };
  }

  const isSubscription = recurring.length > 0;

  // A subscription has to belong to somebody. The webhook links it by
  // `user_id`, and a guest has none — so unlike a one-off purchase, this cannot
  // be claimed after the fact.
  if (isSubscription && !user) {
    return {
      error: "Please sign in before subscribing, so the membership is attached to your account.",
    };
  }

  // Inline price_data cannot express a recurring charge, so an unsynced
  // membership must not fall back — it would silently become a one-off.
  const unsynced = recurring.find((l) => !l.stripePriceId);
  if (unsynced) {
    console.error("recurring price is not synced to Stripe", { slug: unsynced.slug });
    return {
      error: "This membership is not available to buy just now. Please try again shortly.",
    };
  }

  const order = await createPendingOrder({
    userId: user?.id ?? null,
    guestEmail: user ? null : email,
    lines,
    checkoutMode: isSubscription ? "subscription" : "payment",
  });

  if (!order) {
    return { error: "We couldn't start checkout. Please try again." };
  }

  // Which tier this subscription grants, read from our own tables rather than
  // inferred from the product name.
  let membershipTier: string | null = null;
  if (isSubscription) {
    const { data: tier } = await createAdminClient()
      .from("membership_tiers")
      .select("tier")
      .eq("product_id", recurring[0].productId)
      .maybeSingle();
    membershipTier = (tier as { tier?: string } | null)?.tier ?? null;
  }

  let url: string | null = null;

  try {
    // A signed-in buyer pays as their own Stripe Customer, so the card,
    // receipts and any subscription all land on the one record the billing
    // page and Customer Portal open (migration 0021). A guest has no account
    // to attach a customer to, and pays by email as before.
    const customer = user?.email ? await ensureStripeCustomer(user.id, user.email) : null;

    const session = await stripe().checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      ...(customer ? { customer } : { customer_email: email }),
      // Prefer the synced Stripe Price. Inline price_data is the fallback for
      // a catalogue that has not been synced yet — it works, but Stripe creates
      // a throwaway Product per purchase, which destroys per-product reporting
      // (note 09 §12). Run the sync and this branch stops being used.
      line_items: lines.map((line) =>
        line.stripePriceId
          ? { quantity: line.quantity, price: line.stripePriceId }
          : {
              quantity: line.quantity,
              price_data: {
                currency: line.currency.toLowerCase(),
                unit_amount: line.unitAmount,
                product_data: { name: line.name },
              },
            },
      ),
      // Our own order id travels with the session so the webhook can find it
      // without trusting anything from the browser (note 09 §14).
      metadata: { order_id: order.orderId },

      // The subscription webhook reads its metadata, NOT the session's — a
      // renewal months later fires against the subscription and has no session
      // to look at. Without this the membership could never be linked to a
      // customer or a tier.
      ...(isSubscription
        ? {
            subscription_data: {
              metadata: {
                user_id: user!.id,
                order_id: order.orderId,
                ...(membershipTier ? { membership_tier: membershipTier } : {}),
              },
            },
          }
        : {}),

      success_url: absoluteUrl(`/checkout/success?order=${order.orderId}`),
      cancel_url: absoluteUrl(`/checkout/cancel?order=${order.orderId}`),
    });
    url = session.url;

    // RECORD THE SESSION ID ON THE ORDER.
    //
    // Without this the reconciliation job cannot see the order at all:
    // `orders_awaiting_reconciliation()` requires `external_reference is not
    // null`, so a paid order whose webhook was lost stays 'pending' forever
    // with no way to recover it automatically. Observed exactly that — a
    // completed, paid session against an order the reconciler skipped.
    //
    // Written with the service role because the order may belong to a guest,
    // who has no session and therefore no RLS path to their own row.
    await createAdminClient()
      .from("orders")
      .update({ external_reference: session.id })
      .eq("id", order.orderId);
  } catch {
    return {
      error:
        "Payments are unavailable right now. Your order has been saved — please try again shortly.",
    };
  }

  if (!url) return { error: "We couldn't reach the payment provider." };

  redirect(url);
}
