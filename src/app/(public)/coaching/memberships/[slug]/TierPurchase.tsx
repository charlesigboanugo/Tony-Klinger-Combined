"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  hasBothPeriods,
  isBillingPeriod,
  pickPrice,
  yearlySaving,
  type BillingPeriod,
  type SelectablePrice,
} from "@/lib/commerce/billing";
import { formatPrice } from "@/lib/commerce/pricing";
import { cn } from "@/lib/utils/cn";

/**
 * Choose how to pay, then buy — note 07 §37.1, note 09 §16.1.
 *
 * THE SELECTION MADE ON THE LISTING IS HONOURED HERE. It arrives as
 * `?billing=` and pre-selects the matching option, so someone who chose "One
 * year" on the comparison grid is not quietly shown and sold the monthly price
 * on the next screen.
 *
 * It stays CHANGEABLE. Carrying a choice forward silently, with no way to
 * revise it, is its own trap: the customer should be able to see both options
 * and switch right up to the moment they commit. The chosen period is then
 * appended to the checkout link, and the server re-reads it and prices against
 * the same `pickPrice` rule — so the amount displayed here is the amount
 * charged.
 *
 * A tier sold only one way renders no chooser at all, because there is no
 * choice to make.
 */
export function TierPurchase({
  tierName,
  productSlug,
  prices,
}: {
  tierName: string;
  /**
   * The PRODUCT slug, never the tier slug. The tier is `gold` and the product
   * is `membership-gold`; the order pipeline resolves products, so a link built
   * from the tier slug reaches a checkout page with nothing to sell.
   */
  productSlug: string | null;
  prices: SelectablePrice[];
}) {
  const params = useSearchParams();
  const fromUrl = params.get("billing");

  const [period, setPeriod] = useState<BillingPeriod>(
    isBillingPeriod(fromUrl) ? fromUrl : "monthly",
  );

  const selected = pickPrice(prices, period);
  const saving = yearlySaving(prices);
  const bothWays = hasBothPeriods(prices);

  // No price, or no active product behind the tier: there is nothing to sell,
  // and a button that leads to an empty checkout is worse than no button.
  if (!selected || !productSlug) {
    return (
      <div className="rounded-(--radius-lg) border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">What it costs</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pricing for {tierName} has not been published yet. Everything listed
          above is included when it is.
        </p>
      </div>
    );
  }

  const options: { value: BillingPeriod; label: string; note: string }[] = [
    { value: "monthly", label: "Monthly", note: "Renews until you cancel" },
    { value: "yearly", label: "One payment", note: "One year, does not renew" },
  ];

  return (
    <div className="rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card">
      <h2 className="font-display text-lg font-semibold">What it costs</h2>

      {bothWays ? (
        <div
          role="radiogroup"
          aria-label="How to pay"
          className="mt-4 grid gap-2 sm:grid-cols-2"
        >
          {options.map((option) => {
            const price = pickPrice(prices, option.value);
            if (!price) return null;
            const active = period === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPeriod(option.value)}
                className={cn(
                  "rounded-(--radius) border p-4 text-left transition-[border-color,background-color] duration-(--dur-fast)",
                  active
                    ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                    : "border-input-border hover:border-primary/50 hover:bg-surface-muted",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{option.label}</span>
                  {/* A real radio mark, so the control reads as a choice. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      active ? "border-primary" : "border-input-border",
                    )}
                  >
                    {active ? (
                      <span className="size-2 rounded-full bg-primary" />
                    ) : null}
                  </span>
                </span>

                <span className="mt-2 block font-display text-2xl font-semibold tabular-nums">
                  {formatPrice(price.amount, price.currency)}
                  {option.value === "monthly" ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / month
                    </span>
                  ) : null}
                </span>

                <span className="mt-1 block text-xs text-muted-foreground">
                  {option.note}
                </span>

                {option.value === "yearly" && saving ? (
                  <span className="mt-2 inline-block rounded-full bg-accent/12 px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
                    Save {formatPrice(saving, price.currency)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 font-display text-3xl font-semibold tabular-nums">
          {formatPrice(selected.amount, selected.currency)}
          {selected.billing_type === "recurring" ? (
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {selected.interval ?? "month"}
            </span>
          ) : null}
        </p>
      )}

      <Link
        href={`/checkout?membership=${productSlug}&billing=${period}`}
        className={cn(
          "mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6",
          "bg-button text-[0.9375rem] font-semibold text-button-foreground shadow-card",
          "transition-[transform,box-shadow,filter] duration-(--dur-fast) ease-expo",
          "hover:-translate-y-0.5 hover:shadow-lift hover:brightness-110",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
          "active:translate-y-px motion-reduce:transform-none",
        )}
      >
        Join {tierName} &mdash; {formatPrice(selected.amount, selected.currency)}
        {period === "monthly" && selected.billing_type === "recurring"
          ? " / month"
          : ""}
      </Link>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        You can change how you pay before you confirm.
      </p>
    </div>
  );
}
