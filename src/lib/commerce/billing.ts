/**
 * Billing-period selection — note 09 §16.1.
 *
 * DELIBERATELY NOT `server-only`. This is the single rule deciding which stored
 * price answers "monthly" and which answers "a year up front", and BOTH sides
 * need it: the storefront to show a figure, the server to charge one. Two
 * copies of this rule would eventually disagree, and the failure mode is a
 * customer being shown £160 and charged £15 a month.
 *
 * It never computes a price. It only chooses between prices that already exist
 * in the database, which remains authoritative (note 09 §9).
 */

export type BillingPeriod = "monthly" | "yearly";

export const BILLING_PERIODS: BillingPeriod[] = ["monthly", "yearly"];

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

/** The shape both the storefront and the order pipeline can supply. */
export type SelectablePrice = {
  amount: number;
  currency: string;
  billing_type: string;
  interval: string | null;
};

/** The monthly recurring price, if the product has one. */
function monthlyOf<T extends SelectablePrice>(prices: T[]): T | undefined {
  return prices.find(
    (p) => p.billing_type === "recurring" && p.interval === "month",
  );
}

/**
 * The "one year" price.
 *
 * A one-time payment IS the yearly option for a membership — that is precisely
 * what a lump-sum term is (note 09 §16.1) — so it is matched alongside a true
 * recurring/year price rather than treated as a third category. A genuine
 * annual subscription wins where both somehow exist.
 */
function yearlyOf<T extends SelectablePrice>(prices: T[]): T | undefined {
  return (
    prices.find((p) => p.billing_type === "recurring" && p.interval === "year") ??
    prices.find((p) => p.billing_type === "one_time")
  );
}

/**
 * Pick the price for a period, falling back to the other when a product is
 * only sold one way. Returns null when there is no active price at all —
 * Ultimate has none, and an invented figure is worse than an honest absence.
 */
export function pickPrice<T extends SelectablePrice>(
  prices: T[],
  period: BillingPeriod,
): T | null {
  const monthly = monthlyOf(prices);
  const yearly = yearlyOf(prices);
  if (period === "monthly") return monthly ?? yearly ?? null;
  return yearly ?? monthly ?? null;
}

/** Minor units saved by paying for the year, or null when it is not cheaper. */
export function yearlySaving(prices: SelectablePrice[]): number | null {
  const monthly = monthlyOf(prices);
  const yearly = yearlyOf(prices);
  if (!monthly || !yearly) return null;
  const saving = monthly.amount * 12 - yearly.amount;
  return saving > 0 ? saving : null;
}

/** True when the product is genuinely sold both ways, so a toggle is meaningful. */
export function hasBothPeriods(prices: SelectablePrice[]): boolean {
  return Boolean(monthlyOf(prices) && yearlyOf(prices));
}
