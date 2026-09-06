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

export function formatInterval(
  billingType: string | null,
  interval: string | null,
): string {
  if (billingType !== "recurring" || !interval) return "one-time";
  return interval === "year" ? "per year" : "per month";
}
