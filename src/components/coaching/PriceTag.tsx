import { formatPrice } from "@/lib/commerce/pricing";
import type { ProductPrice } from "@/lib/content/coaching";

/**
 * Price display — note 10 §23.
 *
 * Shows EVERY active price, because several products are legitimately sold two
 * ways: a monthly subscription alongside a one-year one-off. Rendering only the
 * first makes the other look unavailable, and picking the cheapest misleads.
 *
 * Nothing is rendered when a product has no active price. That is a real state
 * — Ultimate membership has no price in any source site — and an empty space
 * reads better than "£0" or "Price on application" that nobody decided on.
 */
export function PriceTag({ prices }: { prices: ProductPrice[] }) {
  if (prices.length === 0) return null;

  return (
    <p className="mt-2 text-sm">
      {prices
        .slice()
        .sort((a, b) => a.amount - b.amount)
        .map((price) => (
          <span
            key={`${price.billing_type}-${price.amount}`}
            className="mr-3 inline-block"
          >
            <span className="font-semibold">
              {formatPrice(price.amount, price.currency)}
            </span>
            <span className="text-muted-foreground">
              {price.billing_type === "recurring"
                ? ` / ${price.interval ?? "month"}`
                : " one-off"}
            </span>
          </span>
        ))}
    </p>
  );
}
