"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isBillingPeriod } from "@/lib/commerce/billing";
import { readCart } from "@/lib/commerce/cart";
import { createPendingOrder, priceCart } from "@/lib/commerce/orders";
import { giftBlock } from "@/lib/commerce/gift";
import { applyPassUpgrades } from "@/lib/commerce/pass-upgrade";
import { saleCheck } from "@/lib/commerce/sale-check";
import { callerFingerprint, checkRateLimit } from "@/lib/security/rate-limit";
import { stripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
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
  // The Group Coaching session a single session is bought for (migration 0022).
  session: z.uuid().optional(),
  email: z.email().optional(),
  // Bought for someone else: `email` is then the RECIPIENT's (lib/commerce/gift).
  gift: z.literal("1").optional(),
});

export type CheckoutState = {
  error?: string;
  /** The email typed, so the field keeps it when the form comes back. */
  email?: string;
  /** Set when that email has an account: the form offers sign-in first. */
  accountEmail?: string;
};

export async function startCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  // Every optional field is read as `|| undefined`: an absent field is null in
  // FormData, which `.optional()` refuses. `product` was read bare, so a cart
  // checkout (no product, the whole cart is bought) failed here every time.
  const parsed = schema.safeParse({
    product: formData.get("product") || undefined,
    billing: formData.get("billing") || undefined,
    session: formData.get("session") || undefined,
    email: formData.get("email") || undefined,
    gift: formData.get("gift") || undefined,
  });

  if (!parsed.success) {
    // Only an email problem is the customer's to fix; anything else is the
    // page sending something odd, and blaming their email was misleading.
    const emailWrong = parsed.error.issues.some((issue) => issue.path[0] === "email");
    return {
      error: emailWrong
        ? "Enter a valid email address to continue."
        : "Something went wrong with this checkout. Please go back to your cart and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
    A GIFT is a guest order made out to the recipient (owner, 2026-10-15). It
    is priced and checked as for a signed-out visitor — the buyer's own pass
    must not make somebody else's gift cheaper, and what the buyer already owns
    must not stop them giving it — and the order belongs to nobody until the
    recipient adds it to their account.
  */
  const gift = parsed.data.gift === "1";
  const email = gift ? parsed.data.email : (user?.email ?? parsed.data.email);
  if (!email) {
    return {
      error: gift ? "Enter the email of the person it's for." : "We need an email address to send your receipt.",
    };
  }
  if (gift && user?.email && user.email.toLowerCase() === email.toLowerCase()) {
    return { email, error: "That's your own email. To buy it for yourself, choose \"Buy it for yourself instead\" above." };
  }
  const asker = gift ? createPublicClient() : supabase;

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
          sessionId: parsed.data.session,
        },
      ]
    : (await readCart()).map((l) => ({
        productSlug: l.slug,
        quantity: l.qty,
        billing: l.billing,
      }));

  // A higher pass bought by somebody holding a lower one is an upgrade, priced
  // at the difference (migration 0027). Decided here, from the session, never
  // from the form.
  const lines = await applyPassUpgrades(asker, await priceCart(requested));
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
  if (gift) {
    const block = giftBlock(lines);
    if (block) return { email, error: block };
  }

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

  // A session bought for a date is a seat in somebody's name, like a ticket:
  // a guest order would hold no seat until claimed, and the date might pass.
  if (lines.some((l) => l.needsDate) && !user) {
    return { error: "Please sign in to buy a session, so your seat is kept in your name." };
  }

  /*
    CAN EACH LINE BE SOLD TO THIS PERSON NOW (migration 0012)? Asked of the
    database before any order exists, so nobody pays twice for a course or a
    place they already hold, buys more sessions while they still have some to
    use, or pays for a full cohort, a retreat with no date, or a level they
    have not been accepted onto. Capacity is whatever is set in admin.
  */
  for (const line of lines) {
    const block = await saleCheck(asker, line);
    if (block) return { error: block.message };
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
        "A subscription has to be bought on its own. Please check it out separately from the other items.",
    };
  }

  const isSubscription = recurring.length > 0;

  // A subscription has to belong to somebody. The webhook links it by
  // `user_id`, and a guest has none — so unlike a one-off purchase, this cannot
  // be claimed after the fact.
  if (isSubscription && !user) {
    return {
      error: "Please sign in before subscribing, so it is attached to your account.",
    };
  }

  // One subscription at a time. A second one would bill twice for one
  // membership; changing tier is done from the account, not by subscribing again.
  if (isSubscription && user) {
    const { data: current } = await supabase.rpc("my_membership");
    const held = (current as Array<{ tier_name: string; source_type: string }> | null)?.[0];
    if (held && held.source_type === "membership") {
      return {
        error: `You already have a ${held.tier_name}. You can manage it under Account → Billing; to change tier, please get in touch.`,
      };
    }
  }

  // Inline price_data cannot express a recurring charge, so an unsynced
  // membership must not fall back — it would silently become a one-off.
  const unsynced = recurring.find((l) => !l.stripePriceId);
  if (unsynced) {
    console.error("recurring price is not synced to Stripe", { slug: unsynced.slug });
    return {
      error: "This pass is not available to buy just now. Please try again shortly.",
    };
  }

  /*
    AN EMAIL THAT HAS AN ACCOUNT CANNOT CHECK OUT AS A GUEST (owner,
    2026-10-15; note 05 §29.2.1). Its owner signs in, so the sale checks see
    what they already hold (no paying twice for a course), and a mistyped
    email can never put a purchase within reach of somebody else's account.
    Asked last, once everything else says the sale can go ahead.

    A gift is checked too, below: it may go only to an email with no account.

    Saying an email has an account tells the caller something, so the question
    is rate-limited per caller. Past the limit checkout waits rather than
    skipping the question, which would reopen the guest route it closes.
  */
  /*
    A GIFT GOES ONLY TO AN EMAIL WITH NO ACCOUNT (owner, 2026-10-15; note 05
    §29.2.2). Somebody with an account buys for themselves, signed in, where
    the sale checks see what they hold; a gift to them could duplicate what
    they own, and a mistyped address could reach a stranger's account.
  */
  if (!user || gift) {
    const allowed = await checkRateLimit("checkout-account", await callerFingerprint(), 20, 600);
    if (!allowed) {
      return { email, error: "Too many attempts. Please wait a few minutes and try again, or sign in." };
    }
    const { data: hasAccount } = await createAdminClient().rpc("email_has_account", { p_email: email });
    if (hasAccount === true) {
      if (gift) {
        return {
          email,
          error: "That email already has an account, so this can't be sent to it as a gift. They can buy it themselves, signed in.",
        };
      }
      return { email, accountEmail: email };
    }
  }

  const order = await createPendingOrder({
    userId: gift ? null : (user?.id ?? null),
    guestEmail: gift || !user ? email : null,
    isGift: gift,
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
      // A gift's receipt goes to the PAYER: a signed-in buyer's own customer,
      // or, signed out, whatever email they give Stripe — never the recipient,
      // who hears from us with the link to add it instead.
      ...(customer ? { customer } : gift ? {} : { customer_email: email }),
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
