"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  pickPrice,
  yearlySaving,
  type BillingPeriod,
} from "@/lib/commerce/billing";
import { formatPrice } from "@/lib/commerce/pricing";
import type { ProductPrice } from "@/lib/content/coaching";
import { cn } from "@/lib/utils/cn";

export { pickPrice, yearlySaving };
export type { BillingPeriod };

/**
 * Billing period switching — one control, every card responds.
 *
 * Every membership tier is sold two ways for the same year of access: a monthly
 * subscription, or a single payment (note 09 §16.1). Showing both figures at
 * once forces the visitor to do the comparison themselves, and on a four-tier
 * grid that is eight numbers competing for attention.
 *
 * So the period is chosen ONCE, at the top of the page, and every card shows
 * the matching figure. The state lives in context rather than in each card
 * because the cards must agree — a grid where Silver shows monthly and Gold
 * shows yearly is unreadable.
 *
 * This is presentation only. It selects which existing price to display; it
 * never computes a price. The database remains authoritative (note 09 §9).
 *
 * THE SELECTION RULE LIVES IN `@/lib/commerce/billing`, not here, and the order
 * pipeline imports the same function. Two copies would eventually disagree, and
 * the failure mode is a customer shown £160 and charged £15 a month.
 *
 * The choice is also mirrored into the URL as `?billing=`, so it survives a
 * click through to a detail page and on into checkout — otherwise the customer
 * picks "One year", follows a link, and is quietly back on monthly.
 */

const BillingPeriodContext = createContext<{
  period: BillingPeriod;
  setPeriod: (p: BillingPeriod) => void;
} | null>(null);

export function BillingPeriodProvider({
  children,
  initial = "monthly",
}: {
  children: ReactNode;
  initial?: BillingPeriod;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The URL wins on first render, so a shared or reloaded link opens on the
  // period it names rather than snapping back to the default.
  const fromUrl = params.get("billing");
  const [period, setPeriodState] = useState<BillingPeriod>(
    fromUrl === "monthly" || fromUrl === "yearly" ? fromUrl : initial,
  );

  const setPeriod = useCallback(
    (next: BillingPeriod) => {
      setPeriodState(next);
      const q = new URLSearchParams(params.toString());
      q.set("billing", next);
      // `scroll: false` — changing a price should not jump the page to the top
      // while the customer is reading a tier's benefits.
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod]);
  return (
    <BillingPeriodContext.Provider value={value}>
      {children}
    </BillingPeriodContext.Provider>
  );
}

export function useBillingPeriod() {
  const ctx = useContext(BillingPeriodContext);
  if (!ctx) {
    throw new Error("useBillingPeriod must be used inside <BillingPeriodProvider>");
  }
  return ctx;
}

/**
 * The segmented control.
 *
 * A real segmented control rather than a checkbox styled as a switch: there are
 * two named choices and both labels must stay readable. The moving indicator is
 * a transform on a single absolutely-positioned element, so it animates on the
 * compositor and does not reflow the labels.
 */
export function BillingToggle({
  className,
  savingLabel,
}: {
  className?: string;
  savingLabel?: string;
}) {
  const { period, setPeriod } = useBillingPeriod();

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setPeriod(period === "monthly" ? "yearly" : "monthly");
      }
    },
    [period, setPeriod],
  );

  return (
    // The control plus its savings badge is wider than a phone, so the row
    // must wrap and stay inside its container rather than setting the page's
    // scroll width.
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center justify-center gap-3",
        className,
      )}
    >
      <div
        role="radiogroup"
        aria-label="Billing period"
        onKeyDown={onKey}
        className="relative inline-flex rounded-full border border-border bg-surface p-1"
      >
        {(
          [
            ["monthly", "Monthly"],
            ["yearly", "One year"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={period === value}
            onClick={() => setPeriod(value)}
            className={cn(
              // The active state paints its OWN background rather than relying
              // on a separately-positioned sliding pill. The pill looked better
              // but meant the label's colour was only legible if a sibling
              // element happened to be underneath it — white-on-white the
              // moment it was not, and unreadable in forced-colours mode.
              "relative z-10 min-w-24 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-(--dur-base) ease-expo sm:min-w-28 sm:px-5",
              period === value
                ? "bg-button text-button-foreground shadow-card"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {savingLabel ? (
        <span className="rounded-full bg-accent/12 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
          {savingLabel}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A single tier's price for the selected period.
 *
 * Renders nothing rather than "£0" when a product has no price — Ultimate has
 * none in any source site, and an invented figure is worse than an honest
 * absence. The caller decides what to show instead.
 */
export function TierPrice({ prices }: { prices: ProductPrice[] }) {
  const { period } = useBillingPeriod();
  const price = pickPrice(prices, period);
  const saving = yearlySaving(prices);

  if (!price) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Price on application
      </p>
    );
  }

  const isMonthly =
    price.billing_type === "recurring" && price.interval === "month";

  return (
    <div className="mt-4">
      <p className="flex items-baseline gap-1.5">
        {/* key on the amount so React swaps the node and the fade replays */}
        <span
          key={price.amount}
          className="font-display text-4xl leading-none font-semibold tabular-nums motion-safe:animate-[nav-fade_var(--dur-base)_var(--ease-expo)]"
        >
          {formatPrice(price.amount, price.currency)}
        </span>
        <span className="text-sm text-muted-foreground">
          {isMonthly ? "/ month" : "/ year"}
        </span>
      </p>

      {/* Reserve the line in both states so switching period does not shift
          the card's height and jog the whole grid. */}
      <p className="mt-1 h-4 text-xs text-muted-foreground">
        {period === "yearly" && saving
          ? `Save ${formatPrice(saving, price.currency)} against monthly`
          : period === "monthly" && saving
            ? "Cheaper paid yearly"
            : ""}
      </p>
    </div>
  );
}

/**
 * A link that carries the currently selected billing period.
 *
 * This is what makes the choice survive a click. Without it a customer selects
 * "One year", follows the card's CTA, and the detail page — which knows
 * nothing about the toggle — quietly shows and sells the monthly price. The
 * period travels as `?billing=` all the way through to checkout, where the
 * server re-reads it and prices against the same rule (note 09 §16.1).
 */
export function PeriodLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { period } = useBillingPeriod();
  const sep = href.includes("?") ? "&" : "?";
  return (
    <Link href={`${href}${sep}billing=${period}`} className={className}>
      {children}
    </Link>
  );
}
