import "server-only";

import { formatPrice } from "@/lib/commerce/pricing";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Product options — note 07 §14, §26; migration 0012.
 *
 * Some offers are sold more than one way: a Group Coaching seat or a pack of
 * eight, a private session or eight, the Virtual Retreat at Level 1, 2 or 3.
 * Each way is its own product (its own price, its own entitlement), and the
 * products of one offer share an `option_group`.
 *
 * This is what lets the storefront, the cart and checkout all offer the same
 * switch between them, so a customer who picked one session can change to
 * eight at any step without going back to find the other product.
 *
 * Public data, read as `anon`: only active products and active prices come
 * back, and nothing here depends on who is asking.
 */
export type ProductOption = {
  /** The product slug — what the cart and checkout name. */
  slug: string;
  /** Its name on the switch: "1 session", "8 sessions", "Level 2". */
  label: string;
  /** The product's full name, for a summary line. */
  name: string;
  group: string;
  amount: number;
  currency: string;
  /** Sessions granted per unit, where the product is counted. */
  credits: number | null;
  /** Months what it grants stays usable. Null for no expiry. */
  validMonths: number | null;
  id: string;
  /** For a pack: the id of the single-session product it is a pack of. */
  packOf: string | null;
};

type Row = {
  id: string;
  pack_of: string | null;
  slug: string;
  name: string;
  option_group: string | null;
  option_label: string | null;
  option_position: number;
  credits: number | null;
  valid_months: number | null;
  prices: Array<{ amount: number; currency: string; billing_type: string; active: boolean }> | null;
};

function toOption(row: Row): ProductOption | null {
  // Options are one-off purchases; a recurring price is a membership's period,
  // which has its own switch (lib/commerce/billing).
  const price = (row.prices ?? [])
    .filter((p) => p.active && p.billing_type === "one_time")
    .sort((a, b) => a.amount - b.amount)[0];
  if (!row.option_group || !price) return null;
  return {
    slug: row.slug,
    label: row.option_label ?? row.name,
    name: row.name,
    group: row.option_group,
    amount: price.amount,
    currency: price.currency,
    credits: row.credits,
    validMonths: row.valid_months,
    id: row.id,
    packOf: row.pack_of,
  };
}

const SELECT =
  "id,pack_of,slug,name,option_group,option_label,option_position,credits,valid_months,prices(amount,currency,billing_type,active)";

/** Every purchasable option of one offer, in order. */
export async function optionGroup(group: string): Promise<ProductOption[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select(SELECT)
    .eq("option_group", group)
    .eq("status", "active")
    .order("option_position")
    .order("slug");

  return ((data ?? []) as unknown as Row[])
    .map(toOption)
    .filter((o): o is ProductOption => o !== null);
}


/**
 * The alternatives for each of these products, keyed by product slug.
 *
 * A product with no group, or alone in its group, has no entry — there is
 * nothing to switch to, and a one-button switch is noise.
 */
export async function optionsForProducts(slugs: string[]): Promise<Map<string, ProductOption[]>> {
  const result = new Map<string, ProductOption[]>();
  if (slugs.length === 0) return result;

  const supabase = createPublicClient();

  const { data: own } = await supabase
    .from("products")
    .select("slug,option_group")
    .in("slug", slugs)
    .not("option_group", "is", null);

  const groupBySlug = new Map(
    ((own ?? []) as Array<{ slug: string; option_group: string | null }>)
      .filter((r) => r.option_group)
      .map((r) => [r.slug, r.option_group as string]),
  );
  const groups = [...new Set(groupBySlug.values())];
  if (groups.length === 0) return result;

  const { data } = await supabase
    .from("products")
    .select(SELECT)
    .in("option_group", groups)
    .eq("status", "active")
    .order("option_position")
    .order("slug");

  const byGroup = new Map<string, ProductOption[]>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const option = toOption(row);
    if (!option) continue;
    byGroup.set(option.group, [...(byGroup.get(option.group) ?? []), option]);
  }

  for (const [slug, group] of groupBySlug) {
    const options = byGroup.get(group) ?? [];
    if (options.length > 1) result.set(slug, options);
  }
  return result;
}

/**
 * What a pack saves against the same sessions bought singly, in minor units:
 * the single (`pack_of`) times the pack's sessions, less the pack. From the
 * prices on sale, never written in (owner, 2026-10-29), so a price changed in
 * admin moves it. Zero when there is no single to compare, or no saving.
 */
export function packSaving(option: ProductOption, options: ProductOption[]): number {
  const single = option.packOf ? options.find((o) => o.id === option.packOf) : undefined;
  const count = option.credits ?? 1;
  if (!single || count < 2) return 0;
  return Math.max(single.amount * count - option.amount, 0);
}

/**
 * "Save £200 with a pack of 8", for a card or hero: the offer's best saving and
 * the pack it is on, or null. Worded from the pack's sessions, not its switch
 * label, so it reads as an offer whatever the label says.
 */
export function packSavingOffer(options: ProductOption[]): { label: string; slug: string } | null {
  const best = options
    .map((o) => ({ o, saved: packSaving(o, options) }))
    .filter((x) => x.saved > 0)
    .sort((a, b) => b.saved - a.saved)[0];
  return best
    ? { label: `Save ${formatPrice(best.saved, best.o.currency)} with a pack of ${best.o.credits}`, slug: best.o.slug }
    : null;
}

/** "Use within three months", in words, or null when it does not lapse. */
export function validityNote(months: number | null): string | null {
  if (!months) return null;
  const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const n = words[months] ?? String(months);
  return `Use within ${n} month${months === 1 ? "" : "s"}`;
}
