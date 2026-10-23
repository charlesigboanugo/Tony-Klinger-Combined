import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PricedLine } from "@/lib/commerce/orders";

/**
 * Moving up a Coaching Pass for the difference in price — owner, 2026-10-10;
 * migration 0027.
 *
 *   Silver → Gold, Silver → Platinum, Gold → Platinum
 *   for the DIFFERENCE between the two passes' prices
 *   while at least FOUR MONTHS of the pass remain
 *
 * The holder then has the higher pass for the rest of the SAME year, and what
 * it adds: the extra series, every playlist, the Q&A, the retreat. Nothing is
 * extended; the end date does not move.
 *
 * This is the one place that decides it. `passUpgrade` answers for a tier (the
 * pass pages ask it, to show the figure), and `applyPassUpgrades` rewrites the
 * priced lines of a cart or checkout, so the amount shown, the amount charged
 * and what fulfilment does all come from the same answer. The database then
 * changes the tier of the pass named on the line (`upgrade_from`).
 */
export const UPGRADE_MIN_MONTHS = 4;

export type HeldPass = {
  entitlementId: string;
  tierId: string;
  tierName: string;
  rank: number;
  /** Held as a renewing subscription, which cannot be upgraded this way. */
  subscription: boolean;
  expiresAt: string | null;
  /** Its own one-payment price today, in minor units, or null if it has none. */
  amount: number | null;
  /** At least four months of it remain. */
  canUpgrade: boolean;
  /** The last day an upgrade can be bought, or null where the pass has no end. */
  upgradeUntil: string | null;
};

/** The caller's live pass, with what an upgrade needs to know. Null for none. */
export async function heldPass(supabase: SupabaseClient): Promise<HeldPass | null> {
  const { data } = await supabase.rpc("my_membership");
  const row = (
    data as Array<{
      entitlement_id: string;
      tier_id: string;
      tier_name: string;
      rank: number;
      source_type: string;
      expires_at: string | null;
    }> | null
  )?.[0];
  if (!row) return null;

  const { data: tier } = await supabase
    .from("membership_tiers")
    .select("products(prices(amount,billing_type,active))")
    .eq("id", row.tier_id)
    .maybeSingle();
  const prices =
    (tier as unknown as { products: { prices: Array<{ amount: number; billing_type: string; active: boolean }> } | null } | null)
      ?.products?.prices ?? [];
  const amount = prices.find((p) => p.active && p.billing_type === "one_time")?.amount ?? null;

  const ends = row.expires_at ? new Date(row.expires_at) : null;
  // Four calendar months before the end: the last moment to move up.
  const cutoff = ends ? new Date(ends) : null;
  if (cutoff) cutoff.setUTCMonth(cutoff.getUTCMonth() - UPGRADE_MIN_MONTHS);

  return {
    entitlementId: row.entitlement_id,
    tierId: row.tier_id,
    tierName: row.tier_name,
    rank: row.rank,
    subscription: row.source_type === "membership",
    expiresAt: row.expires_at,
    amount,
    canUpgrade: row.source_type !== "membership" && (cutoff === null || Date.now() <= cutoff.getTime()),
    upgradeUntil: cutoff ? cutoff.toISOString() : null,
  };
}

/** The rank of the tier a pass product sells, or null if it is not a pass. */
async function tierOfProduct(supabase: SupabaseClient, productId: string): Promise<{ rank: number; name: string } | null> {
  const { data } = await supabase.from("membership_tiers").select("rank,name").eq("product_id", productId).maybeSingle();
  return (data as { rank: number; name: string } | null) ?? null;
}

/**
 * Price a higher pass as an upgrade, where the buyer holds a lower one that
 * can still be upgraded. Lines that are not such an upgrade come back as they
 * were. Never raises a price: a difference of nothing or less is not charged
 * as an upgrade at all (the line is left for `saleCheck` to refuse).
 */
export async function applyPassUpgrades(supabase: SupabaseClient, lines: PricedLine[]): Promise<PricedLine[]> {
  if (!lines.some((l) => l.productType === "membership" && l.billingType !== "recurring")) return lines;

  const held = await heldPass(supabase);
  if (!held || !held.canUpgrade || held.amount === null) return lines;

  return Promise.all(
    lines.map(async (line) => {
      if (line.productType !== "membership" || line.billingType === "recurring") return line;
      const tier = await tierOfProduct(supabase, line.productId);
      if (!tier || tier.rank <= held.rank) return line;
      const difference = line.unitAmount - held.amount!;
      if (difference <= 0) return line;
      return {
        ...line,
        name: `Upgrade: ${held.tierName} to ${tier.name}`,
        unitAmount: difference,
        // The Stripe price is the full price; an upgrade is priced here.
        stripePriceId: null,
        upgradeFrom: held.entitlementId,
        fullAmount: line.unitAmount,
      } satisfies PricedLine;
    }),
  );
}
