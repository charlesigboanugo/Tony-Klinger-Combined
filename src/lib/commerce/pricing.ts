/**
 * Money formatting.
 *
 * Amounts are stored as integer minor units (pence) — never floating point,
 * which cannot represent 0.1 exactly and accumulates error across a cart
 * (note 08 §11).
 */
export function formatPrice(
  amount: number | null | undefined,
  currency = "GBP",
): string {
  if (amount == null) return "Price on application";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

/** A price after `percent` off, in minor units, rounded to the penny. */
export function discounted(amount: number, percent: number): number {
  return amount - Math.round((amount * percent) / 100);
}

/**
 * "Pass holders save 10%", or "save up to 15%" where the passes differ: the
 * one-to-one discount (migration 0026) said across the passes on sale. Null
 * where none of them gives one.
 */
export function passPerkLabel(percents: number[]): string | null {
  const on = percents.filter((p) => p > 0);
  if (on.length === 0) return null;
  const top = Math.max(...on);
  return on.every((p) => p === top) && on.length === percents.length
    ? `Pass holders save ${top}%`
    : `Pass holders save up to ${top}%`;
}

export function formatInterval(
  billingType: string | null,
  interval: string | null,
): string {
  if (billingType !== "recurring" || !interval) return "one-time";
  return interval === "year" ? "per year" : "per month";
}
