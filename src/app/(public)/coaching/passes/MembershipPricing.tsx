"use client";

import Link from "next/link";
import { Suspense } from "react";

import {
  BillingPeriodFromUrl,
  BillingPeriodProvider,
  BillingToggle,
  PeriodLink,
  TierPrice,
  pickPrice,
  useBillingPeriod,
  yearlySaving,
} from "@/components/coaching/billing-period";
import { FILLED_STATES, OUTLINE_STATES } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardBody, CardEyebrow, CardFooter, CardTitle } from "@/components/ui/Card";
import type { ViewerPass } from "@/app/(public)/coaching/actions";
import { passOffer, useViewerPass } from "@/components/coaching/viewer-pass";
import { hasBothPeriods } from "@/lib/commerce/billing";
import { cn } from "@/lib/utils/cn";

/**
 * The CTA is a PeriodLink rather than a ButtonLink because it has to append the
 * selected period, so it borrows the button's appearance instead of its markup.
 */
const CTA_BASE =
  // `min-h`, not a fixed height, and centred text: a longer label ("Upgrade
  // for £280") wraps inside the button rather than spilling out of the card.
  "relative inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2 text-center leading-tight " +
  "text-[0.9375rem] font-semibold transition-[transform,filter,box-shadow,background-color,border-color,color] " +
  "duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-ring active:scale-96 motion-reduce:transform-none";
const CTA_PRIMARY =
  `bg-button text-button-foreground ${FILLED_STATES}`;
const CTA_OUTLINE =
  `border border-input-border text-foreground ${OUTLINE_STATES}`;

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
  /** Everything this tier includes, as stored — its own complete list. */
  benefits: string[];
};

export function MembershipPricing({ tiers }: { tiers: PricedTier[] }) {
  const topRank = Math.max(...tiers.map((t) => t.rank));
  const pass = useViewerPass();

  // The largest real saving across the tiers on sale, from their own prices —
  // not a figure typed here that goes stale the day a price changes.
  const bestSaving = Math.max(
    0,
    ...tiers.map((t) => {
      const monthly = t.prices.find((p) => p.billing_type === "recurring" && p.interval === "month");
      const saving = yearlySaving(t.prices);
      return monthly && saving ? Math.floor((saving / (monthly.amount * 12)) * 100) : 0;
    }),
  );

  // Membership is one payment for twelve months (owner, 2026-10-09), so there
  // is nothing to switch between and no switch. It returns by itself if a tier
  // is ever put on sale two ways again.
  const twoWays = tiers.some((t) => hasBothPeriods(t.prices));

  const content = (
    <>
      {twoWays ? (
        <div className="mb-10 flex justify-center">
          <BillingToggle savingLabel={bestSaving > 0 ? `Save up to ${bestSaving}% yearly` : undefined} />
        </div>
      ) : null}

      {/* Columns follow the number of tiers on sale, so the row is always
          full: three tiers are three across, never three and a gap. */}
      <ol
        className={cn(
          "grid gap-5",
          tiers.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : tiers.length === 2 ? "sm:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {tiers.map((tier, index) => (
          <TierCard key={tier.id} tier={tier} isTop={tier.rank === topRank} delay={index * 70} pass={pass} />
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
  pass,
}: {
  tier: PricedTier;
  isTop: boolean;
  delay: number;
  /** The pass the visitor holds, once known. */
  pass: ViewerPass | null;
}) {
  // How the tier is actually held is a real fact, not the same for every
  // billing choice (note 09 §16.1): a monthly subscription keeps access only
  // as long as it renews, a one-time payment buys the year outright and does
  // not renew at all. Read from the shared toggle so it agrees with the
  // price shown above it, rather than a static line that is only ever right
  // for whichever period happens to be selected. A tier with no price says
  // nothing about how it is billed.
  const { period } = useBillingPeriod();
  // Said from the price itself: a subscription renews, a one-off year does
  // not, and the card must not claim either for the other.
  const price = pickPrice(tier.prices, period);
  const oneOff = tier.prices.find((p) => p.billing_type !== "recurring") ?? null;
  const offer = passOffer(pass, { name: tier.name, rank: tier.rank, amount: oneOff?.amount ?? null, currency: oneOff?.currency ?? "GBP" });

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
        <PeriodLink href={`/coaching/passes/${tier.slug}`} overlay className="z-0 rounded-(--radius-lg)" />

        {/* "The premium tier", not "Everything included" (owner, 2026-10-08):
            Platinum does not include everything — private coaching, cohorts and
            courses are separate — but it is the top tier, which is what Tony's
            own site calls it ("the premium offer"). True of whichever tier
            ranks highest, so it needs no change if the tiers do. */}
        {isTop ? (
          <p className="bg-button px-5 py-1.5 text-center text-[0.6875rem] font-semibold tracking-[0.12em] text-button-foreground uppercase">
            The premium tier
          </p>
        ) : null}

        <CardBody>
          <CardEyebrow>Tier {tier.rank}</CardEyebrow>
          <CardTitle as="h2" className="mt-1 text-2xl tracking-normal">
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
              {price?.billing_type !== "recurring"
                ? "One payment for twelve months. It does not renew"
                : price.interval === "year"
                  ? "Renews yearly. Cancel any time"
                  : "Renews monthly. Cancel any time"}
            </p>
          ) : (
            <div className="flex-1" />
          )}

          <CardFooter className="relative z-10">
            {/* What this tier is to somebody who already holds a pass, said
                on the card rather than discovered at checkout. */}
            {offer.kind === "current" || offer.kind === "included" || offer.kind === "subscription" || offer.kind === "later" ? (
              <div className="w-full rounded-(--radius) border border-border bg-surface-muted/60 p-3 text-center">
                <p className="text-sm font-semibold">{offer.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{offer.note}</p>
                {"href" in offer ? (
                  <Link href={offer.href} className="mt-2 inline-block text-sm font-medium text-accent underline underline-offset-4">
                    {offer.action}
                  </Link>
                ) : null}
              </div>
            ) : (
            // One column: the footer is a row, and the note belongs UNDER the
            // button, not beside a button squeezed to fit it.
            <div className="w-full">
            <PeriodLink
              href={`/coaching/passes/${tier.slug}`}
              className={cn(CTA_BASE, isTop ? CTA_PRIMARY : CTA_OUTLINE)}
            >
              {/*
                A tier name may carry the noun ("… Membership"), which wraps
                the button onto two lines. Trimmed for the label only; the
                heading above still shows the full name.
              */}
              <span className="relative z-10">
                {offer.kind === "upgrade" || offer.kind === "renew" ? offer.label : `Get ${tier.name.replace(/\s+Membership$/i, "")}`}
              </span>
            </PeriodLink>
            {offer.kind === "upgrade" || offer.kind === "renew" ? (
              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">{offer.note}</p>
            ) : null}
            </div>
            )}
          </CardFooter>
        </CardBody>
      </Card>
    </Reveal>
  );
}
