import "server-only";

import { pickPrice, type BillingPeriod } from "@/lib/commerce/billing";
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
};

/** Resolve slugs to real products and their active prices. */
export async function priceCart(lines: CartLine[]): Promise<PricedLine[]> {
  if (lines.length === 0) return [];

  const supabase = await createClient();
  const slugs = lines.map((l) => l.productSlug);

  const { data } = await supabase
    .from("products")
    .select(
      "id,name,slug,status,product_type,prices(id,amount,currency,active,stripe_price_id,billing_type,interval)",
    )
    .in("slug", slugs)
    .eq("status", "active");

  const products = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    product_type: string;
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
    const price = pickPrice(active, line.billing ?? "monthly");
    if (!price) continue;

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
      quantity: Math.max(1, Math.min(line.quantity, 10)),
      currency: price.currency,
    });
  }

  return priced;
}

export function cartTotal(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
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
}): Promise<{ orderId: string; total: number } | null> {
  const { userId, guestEmail, lines, checkoutMode = "payment" } = params;
  if (lines.length === 0) return null;

  const admin = createAdminClient();
  const total = cartTotal(lines);
  const currency = lines[0]?.currency ?? "GBP";

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      guest_email: userId ? null : guestEmail,
      status: "pending",
      currency,
      subtotal: total,
      discount_total: 0,
      total,
      checkout_mode: checkoutMode,
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
    })),
  );

  if (itemsError) return null;

  return { orderId: order.id, total };
}
