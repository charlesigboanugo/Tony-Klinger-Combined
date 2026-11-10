import "server-only";

import { hasBothPeriods, pickPrice, type BillingPeriod } from "@/lib/commerce/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Order creation — note 09 §9, §10, §11.
 *
 * The server prices everything. A total that arrives from the browser is a
 * suggestion, never an authority (note 09 §9): otherwise a customer edits the
 * amount and buys a membership for a penny.
 */

export type CartLine = {
  productSlug: string;
  quantity: number;
  /** The period the customer chose. See the note on price selection below. */
  billing?: BillingPeriod;
  /**
   * The Group Coaching session a single session is being bought for (migration
   * 0022). Named by the browser, so it is only ever an id to be checked: the
   * database decides whether that session can be sold (`session_sale_status`).
   */
  sessionId?: string;
  /**
   * The private coaching time one session is being bought for (migration
   * 0030). Named by the browser, so it is only an id to be checked: the
   * database decides whether this person can have it (`private_slot_sale_status`).
   */
  slotId?: string;
};

export type PricedLine = {
  productId: string;
  priceId: string;
  /** The Stripe Price to bill against, once the catalogue has been synced. */
  stripePriceId: string | null;
  /** 'recurring' lines must go through a Stripe subscription, not a payment. */
  billingType: string;
  interval: string | null;
  /** Carried through so callers can identify the line without guessing. */
  slug: string;
  name: string;
  /** `products.product_type`, for labelling the line in the cart. */
  productType: string;
  unitAmount: number;
  quantity: number;
  currency: string;
  /** The period this line was priced for, where the product is sold both ways. */
  billing: BillingPeriod | null;
  /** The other period's price, so the cart and checkout can offer the switch. */
  otherPeriod: { period: BillingPeriod; amount: number } | null;
  /**
   * One Group Coaching session of a series: it is bought for a date, so it
   * cannot be sold without one (and cannot sit in the cart).
   */
  needsDate: boolean;
  /** The series a Group Coaching product is for. */
  seriesId: string | null;
  /** The session chosen for a `needsDate` line, as the browser named it. */
  sessionId: string | null;
  /**
   * One private coaching session (not a pack): bought for a time chosen first
   * and held while paying (migration 0030), so it cannot sit in the cart. A
   * gift is the exception, bought without one; the recipient books.
   */
  needsTime: boolean;
  /** The time chosen for a `needsTime` line, as the browser named it. */
  slotId: string | null;
  /**
   * The pass this line upgrades (migration 0027), set by `applyPassUpgrades`
   * and never by the browser: the entitlement's id. The line is then priced at
   * the difference, and `fullAmount` is the pass's own price.
   */
  upgradeFrom?: string | null;
  fullAmount?: number;
  /** Sessions one unit grants, where the product is counted (1 for a single session). */
  credits: number | null;
  /**
   * The unit price before a pass holder's discount (migration 0026), set by
   * `applyPassHolderDiscount` and never by the browser. Kept apart from
   * `fullAmount`: an upgrade is priced at a difference, not discounted.
   */
  discountFrom?: number;
  /** The discount's percentage, for labelling the line. */
  discountPercent?: number;
};

/** Resolve slugs to real products and their active prices. */
export async function priceCart(lines: CartLine[]): Promise<PricedLine[]> {
  if (lines.length === 0) return [];

  const supabase = await createClient();
  const slugs = lines.map((l) => l.productSlug);

  const { data } = await supabase
    .from("products")
    .select(
      "id,name,slug,status,product_type,series_id,credits,prices(id,amount,currency,active,stripe_price_id,billing_type,interval)",
    )
    .in("slug", slugs)
    .eq("status", "active");

  const products = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    product_type: string;
    series_id: string | null;
    credits: number | null;
    prices: Array<{
      id: string;
      amount: number;
      currency: string;
      active: boolean;
      stripe_price_id: string | null;
      billing_type: string;
      interval: string | null;
    }>;
  }>;

  const priced: PricedLine[] = [];

  for (const line of lines) {
    const product = products.find((p) => p.slug === line.productSlug);
    if (!product) continue; // Unknown or inactive product is silently dropped.

    /*
      SELECT THE PRICE THE CUSTOMER ACTUALLY CHOSE.

      This previously took `prices.find(p => p.active)` — the first active price
      in whatever order PostgREST returned it. Every membership carries two
      active prices (£15/month and £160 for a year, and so on), so that choice
      was effectively arbitrary: a customer selecting "One year" could be put on
      a monthly subscription, or the reverse. The amount shown on the storefront
      and the amount charged were decided by different rules.

      `pickPrice` is the SAME function the storefront uses to display the figure
      (src/lib/commerce/billing.ts), so the two cannot drift apart. Where a
      product is sold only one way, it falls back to the price that exists.

      Defaulting to monthly when nothing was chosen is deliberate: it is the
      smaller commitment, so an ambiguous cart never silently bills the larger
      amount.
    */
    const active = (product.prices ?? []).filter((p) => p.active);
    const period: BillingPeriod = line.billing ?? "monthly";
    const price = pickPrice(active, period);
    if (!price) continue;

    const bothWays = hasBothPeriods(active);
    const otherPeriodName: BillingPeriod = period === "monthly" ? "yearly" : "monthly";
    const other = bothWays ? pickPrice(active, otherPeriodName) : null;

    priced.push({
      productId: product.id,
      priceId: price.id,
      stripePriceId: price.stripe_price_id,
      billingType: price.billing_type,
      interval: price.interval,
      slug: product.slug,
      name: product.name,
      productType: product.product_type,
      unitAmount: price.amount,
      // ONE OF EACH (owner, 2026-10-08): every item is bought singly. Whatever
      // quantity a cookie or a form carries, the order is priced for one, so
      // nothing upstream of here can make it more.
      quantity: 1,
      currency: price.currency,
      billing: bothWays ? period : null,
      otherPeriod: other ? { period: otherPeriodName, amount: other.amount } : null,
      needsDate: product.product_type === "group_coaching" && Boolean(product.series_id) && (product.credits ?? 1) <= 1,
      seriesId: product.series_id,
      sessionId: line.sessionId ?? null,
      needsTime: product.product_type === "private_coaching" && (product.credits ?? 1) <= 1,
      slotId: line.slotId ?? null,
      credits: product.credits,
    });
  }

  return priced;
}

export function cartTotal(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
}

/** The total before any pass holder's discount: `cartTotal` plus what it took off. */
export function cartSubtotal(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + (l.discountFrom ?? l.unitAmount) * l.quantity, 0);
}

/**
 * Create a pending order and its items.
 *
 * `userId` is taken from the trusted server session by the caller — never from
 * the request body (note 05 §29.1). A guest order carries the checkout email
 * instead and is claimed later (note 05 §29.3).
 *
 * Uses the service-role client because a guest has no session to write under,
 * and because the order must exist even though RLS grants anon no insert.
 */
export async function createPendingOrder(params: {
  userId: string | null;
  guestEmail: string | null;
  lines: PricedLine[];
  /** 'subscription' orders are receipted by their Stripe invoice (migration 0021). */
  checkoutMode?: "payment" | "subscription";
  /** Bought for someone else; `guestEmail` is theirs (migration 0016). */
  isGift?: boolean;
  /** The buyer ticked that it is non-refundable once confirmed (migration 0028). */
  noRefundAgreed?: boolean;
}): Promise<{ orderId: string; total: number } | null> {
  const { userId, guestEmail, lines, checkoutMode = "payment", isGift = false, noRefundAgreed = false } = params;
  if (lines.length === 0) return null;

  const admin = createAdminClient();
  const total = cartTotal(lines);
  // A pass holder's discount is recorded as one (migration 0026): the order
  // keeps what the lines cost before it, and what it took off.
  const subtotal = cartSubtotal(lines);
  const currency = lines[0]?.currency ?? "GBP";

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      guest_email: userId ? null : guestEmail,
      status: "pending",
      currency,
      subtotal,
      discount_total: subtotal - total,
      total,
      checkout_mode: checkoutMode,
      is_gift: isGift,
      no_refund_agreed_at: noRefundAgreed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !order) return null;

  const { error: itemsError } = await admin.from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      price_id: line.priceId,
      // Snapshot: changing the product later must not rewrite this order
      // (note 08 §40).
      product_name_snapshot: line.name,
      unit_amount: line.unitAmount,
      quantity: line.quantity,
      total_amount: line.unitAmount * line.quantity,
      // One metadata object, built from every part that applies: written as
      // separate spreads, a later one replaced an earlier one, so a pass
      // holder's discount wiped out the time a single session was held for.
      ...(() => {
        const metadata = {
          // The date a single session was bought for; fulfilment takes that seat.
          ...(line.needsDate && line.sessionId ? { session_id: line.sessionId } : {}),
          // The time a single private session was held for; the booking itself
          // carries the order, and fulfilment confirms it (migration 0030).
          ...(line.needsTime && line.slotId ? { slot_id: line.slotId } : {}),
          // The pass an upgrade changes the tier of; fulfilment adds no new year.
          ...(line.upgradeFrom ? { upgrade_from: line.upgradeFrom } : {}),
          // What a pass holder's discount took off, for the record.
          ...(line.discountFrom ? { full_unit_amount: line.discountFrom, discount_percent: line.discountPercent } : {}),
        };
        return Object.keys(metadata).length > 0 ? { metadata } : {};
      })(),
    })),
  );

  if (itemsError) return null;

  return { orderId: order.id, total };
}

/**
 * Close an order whose checkout was never finished — note 09 §45 (owner,
 * 2026-10-23).
 *
 * Marked `cancelled` (shown to the customer as "Not completed") once Stripe's
 * payment page has expired unpaid, or no longer exists. Left `pending`, such
 * orders piled up for ever and crowded the reconciliation job, which reads the
 * oldest hundred pending orders, away from the paid ones it exists to rescue.
 *
 * Only a still-pending order is touched, so a payment that lands first always
 * wins. Nothing else changes: the cart is kept, and buying again makes a new
 * order.
 */
export async function cancelUnfinishedOrder(orderId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`cancel unfinished order: ${error.message}`);
  return (data ?? []).length > 0;
}
