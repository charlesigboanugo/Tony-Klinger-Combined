import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { BILLING_PERIODS, type BillingPeriod } from "@/lib/commerce/billing";

/**
 * Cart storage — note 09 §8.
 *
 * The cart holds slugs, quantities and a CHOSEN BILLING PERIOD — never prices.
 * The browser may keep this state for convenience, but the server re-resolves
 * and re-prices every line at checkout (note 09 §9): a total that arrives from
 * a cookie is a suggestion, not an authority.
 *
 * `billing` is the customer's selection, not an amount. It is safe to accept
 * from the browser because it can only ever choose between prices that already
 * exist on the product; it cannot invent one. Without it the pipeline picked
 * whichever active price the database happened to return first, so a
 * membership sold at £15/month and £160/year could be charged either way
 * regardless of what the customer selected.
 *
 * A cookie rather than a database row so a guest can fill a cart without an
 * account, and so an abandoned cart costs nothing to store.
 */
export const CART_COOKIE = "tk_cart";
const MAX_LINES = 20;
const MAX_QUANTITY = 10;

const lineSchema = z.object({
  slug: z.string().min(1).max(100),
  qty: z.number().int().min(1).max(MAX_QUANTITY),
  // Optional so carts written before this existed still parse rather than
  // being discarded wholesale as malformed.
  billing: z.enum(BILLING_PERIODS as [BillingPeriod, ...BillingPeriod[]]).optional(),
});

const cartSchema = z.array(lineSchema).max(MAX_LINES);

export type CartLine = z.infer<typeof lineSchema>;

/** Read the cart, discarding anything malformed rather than trusting it. */
export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (!raw) return [];

  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  const trimmed = lines.filter((l) => l.qty > 0).slice(0, MAX_LINES);

  if (trimmed.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }

  store.set(CART_COOKIE, JSON.stringify(trimmed), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Add or increment a line.
 *
 * A line is identified by slug AND billing period: the same membership bought
 * monthly and bought for a year are different purchases, so adding one must not
 * silently increment the other. Re-adding with a new period UPDATES the
 * existing line rather than stacking a second copy of the same product, which
 * is what a customer changing their mind expects.
 */
export function addLine(
  lines: CartLine[],
  slug: string,
  qty = 1,
  billing?: BillingPeriod,
): CartLine[] {
  const existing = lines.find((l) => l.slug === slug);
  if (existing) {
    return lines.map((l) =>
      l.slug === slug
        ? {
            ...l,
            // Same period: increase quantity. Different period: switch it,
            // keeping the quantity already chosen.
            qty:
              l.billing === billing
                ? Math.min(l.qty + qty, MAX_QUANTITY)
                : l.qty,
            billing: billing ?? l.billing,
          }
        : l,
    );
  }
  return [...lines, { slug, qty: Math.min(qty, MAX_QUANTITY), billing }];
}

/** Change the billing period of a line already in the cart. */
export function setLineBilling(
  lines: CartLine[],
  slug: string,
  billing: BillingPeriod,
): CartLine[] {
  return lines.map((l) => (l.slug === slug ? { ...l, billing } : l));
}

/**
 * Total quantity across all lines, for the masthead's cart badge. Read from the
 * same validated cookie as checkout, so a tampered cookie shows an empty cart
 * rather than an invented count.
 */
export async function readCartCount(): Promise<number> {
  return (await readCart()).reduce((sum, line) => sum + line.qty, 0);
}
