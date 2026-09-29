"use client";

import { Suspense } from "react";

import {
  BillingPeriodFromUrl,
  BillingPeriodProvider,
  BillingToggle,
  PeriodLink,
  TierPrice,
  useBillingPeriod,
} from "@/components/coaching/billing-period";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardBody, CardEyebrow, CardFooter, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

/**
 * The CTA is a PeriodLink rather than a ButtonLink because it has to append the
 * selected period, so it borrows the button's appearance instead of its markup.
 */
const CTA_BASE =
  "relative inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 " +
  "text-[0.9375rem] font-semibold transition-[transform,box-shadow,background-color,border-color,color] " +
  "duration-(--dur-fast) ease-expo focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-ring active:translate-y-px motion-reduce:transform-none";
const CTA_PRIMARY =
  "bg-button text-button-foreground shadow-card hover:-translate-y-0.5 hover:shadow-lift hover:brightness-110";
const CTA_OUTLINE =
  "border border-input-border text-foreground hover:border-primary hover:bg-primary/8 hover:text-primary";

/**
 * The membership grid — note 10 §28, note 07 §10.
 *
 * A client island because the billing toggle is interactive state shared by
 * every card. The tier DATA is resolved on the server and passed in as plain
 * objects: `@/lib/content/coaching` is server-only, and shipping the cumulative
 * benefit resolution to the browser would be pointless work on every load.
 */

export type PricedTier = {
  id: string;
  name: string;
  slug: string;
  rank: number;
  prices: {
    amount: number;
    currency: string;
    billing_type: string;
    interval: string | null;
  }[];
  /** The full cumulative set for this tier, already flattened server-side
   * (note 07 §10) — every label this tier and everything below it grants,
   * with no marker for which tier introduced which. */
  benefits: string[];
};

export function MembershipPricing({ tiers }: { tiers: PricedTier[] }) {
  const topRank = Math.max(...tiers.map((t) => t.rank));

  const content = (
    <>
      <div className="mb-10 flex justify-center">
        <BillingToggle savingLabel="Save up to 33% yearly" />
      </div>

      <ol className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier, index) => (
          <TierCard key={tier.id} tier={tier} isTop={tier.rank === topRank} delay={index * 70} />
        ))}
      </ol>
    </>
  );

  // The pre-built HTML shows monthly prices; `?billing=` applies in the browser.
  return (
    <Suspense fallback={<BillingPeriodProvider initial="monthly">{content}</BillingPeriodProvider>}>
      <BillingPeriodFromUrl initial="monthly">{content}</BillingPeriodFromUrl>
    </Suspense>
  );
}

function TierCard({
  tier,
  isTop,
  delay,
}: {
  tier: PricedTier;
  isTop: boolean;
  delay: number;
}) {
  // How the tier is actually held is a real fact, not the same for every
  // billing choice (note 09 §16.1): a monthly subscription keeps access only
  // as long as it renews, a one-time payment buys the year outright and does
  // not renew at all. Read from the shared toggle so it agrees with the
  // price shown above it, rather than a static line that is only ever right
  // for whichever period happens to be selected. Ultimate has no price yet,
  // so there is nothing true to say about how it is billed.
  const { period } = useBillingPeriod();

  return (
    <Reveal as="li" delay={delay} className="flex">
      <Card
        interactive
        className={cn(
          "w-full",
          // The top tier is distinguished because it genuinely is the end of
          // the ladder — not with an invented "most popular" badge, which
          // would be a marketing claim no data supports.
          isTop && "border-primary/40 ring-1 ring-primary/25",
        )}
      >
        {/* The whole card is clickable (owner, 2026-09-26); the Join button
            below stays the one link in the tab order. */}
        <PeriodLink href={`/coaching/memberships/${tier.slug}`} overlay className="z-0 rounded-(--radius-lg)" />

        {isTop ? (
          <p className="bg-button px-5 py-1.5 text-center text-[0.6875rem] font-semibold tracking-[0.12em] text-button-foreground uppercase">
            Everything included
          </p>
        ) : null}

        <CardBody>
          <CardEyebrow>Tier {tier.rank}</CardEyebrow>
          <CardTitle as="h3" className="mt-1 text-2xl">
            {tier.name}
          </CardTitle>

          <TierPrice prices={tier.prices} />

          {/*
            What the tier includes, each line ticked. A check says "included"
            where a dot only says "a list"; it sits in a soft teal disc, the
            accent the site keeps for state cues, so it reads in both themes
            and does not compete with the red buttons (2026-09-26: the owner
            found dots in red, then white, weak here). The billing term is not
            a benefit, so it follows the list untucked and quieter.
          */}
          <ul className="mt-4 space-y-3 border-t border-border pt-5 text-sm">
            {tier.benefits.map((benefit) => (
              <li key={benefit} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-accent/12 text-accent"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                  </svg>
                </span>
                <span className="leading-snug text-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
          {tier.prices.length > 0 ? (
            <p className="mt-4 flex-1 text-xs text-muted-foreground">
              {period === "yearly"
                ? "One payment — access for a full year"
                : "Renews monthly — cancel any time"}
            </p>
          ) : (
            <div className="flex-1" />
          )}

          <CardFooter className="relative z-10">
            <PeriodLink
              href={`/coaching/memberships/${tier.slug}`}
              className={cn(CTA_BASE, isTop ? CTA_PRIMARY : CTA_OUTLINE)}
            >
              {/*
                The tier names are inconsistent in the data — three are bare
                ("Silver") and one carries the noun ("Ultimate Membership"),
                which wrapped the button onto two lines. Trimmed for the
                label only; the heading above still shows the full name, so
                nothing is hidden.
              */}
              <span className="relative z-10">
                Join {tier.name.replace(/\s+Membership$/i, "")}
              </span>
            </PeriodLink>
          </CardFooter>
        </CardBody>
      </Card>
    </Reveal>
  );
}
