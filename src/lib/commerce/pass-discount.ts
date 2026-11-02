import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PricedLine } from "@/lib/commerce/orders";
import { discounted } from "@/lib/commerce/pricing";

/**
 * A pass holder's discount on one-to-one sessions — owner, 2026-11-02;
 * migration 0026.
 *
 *   a SINGLE one-to-one session, bought by a holder of a live pass
 *   for themselves (not a gift: someone else pays)
 *   at the percentage set on their pass in admin (0 for none)
 *
 * Not the pack, which has its own saving. This is the one place that decides
 * it: `applyPassHolderDiscount` rewrites the priced lines of a cart or
 * checkout, as `applyPassUpgrades` does, so the amount shown, the amount
 * charged and the order's record all come from the same answer. The holder's
 * percentage is read from the session by the database, never from the browser.
 */

/** A line the discount can apply to: one single one-to-one session. */
export function isDiscountable(line: Pick<PricedLine, "productType" | "credits" | "billingType">): boolean {
  return line.productType === "private_coaching" && (line.credits ?? 1) === 1 && line.billingType !== "recurring";
}

/** The signed-in caller's percentage from their live pass. 0 for none, or signed out. */
export async function passHolderDiscount(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("my_private_coaching_discount");
  if (error || typeof data !== "number") return 0;
  return Math.min(Math.max(data, 0), 90);
}

/**
 * Price the single one-to-one sessions in these lines for a pass holder.
 * Lines it does not apply to come back as they were; so does everything for a
 * gift, or for a buyer with no discount.
 */
export async function applyPassHolderDiscount(
  supabase: SupabaseClient,
  lines: PricedLine[],
  { gift = false }: { gift?: boolean } = {},
): Promise<PricedLine[]> {
  if (gift || !lines.some(isDiscountable)) return lines;
  const percent = await passHolderDiscount(supabase);
  if (percent <= 0) return lines;

  return lines.map((line) => {
    if (!isDiscountable(line)) return line;
    const price = discounted(line.unitAmount, percent);
    if (price >= line.unitAmount) return line;
    return {
      ...line,
      unitAmount: price,
      // The Stripe price is the full price; the discounted one is priced here.
      stripePriceId: null,
      discountFrom: line.unitAmount,
      discountPercent: percent,
    } satisfies PricedLine;
  });
}
