import type { Metadata } from "next";

import {
  MembershipPricing,
  type PricedTier,
} from "@/app/(public)/coaching/passes/MembershipPricing";
import { FaqBlock } from "@/components/content/FaqList";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { optionGroup } from "@/lib/commerce/options";
import { formatPrice } from "@/lib/commerce/pricing";
import { listMembershipTiers, listRetreats, listSeries, seriesDatesSet, type MembershipTier } from "@/lib/content/coaching";
import { passFaqs } from "@/lib/content/pass-faq";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Coaching Pass",
  description:
    "The Silver, Gold and Platinum Coaching Pass: a year of live Group Coaching with Tony Klinger, a growing video library and a monthly Q&A.",
  path: "/coaching/passes",
});

export default async function MembershipsPage() {
  const [tiers, series, retreats, datesSet] = await Promise.all([
    listMembershipTiers(),
    listSeries(),
    listRetreats(),
    seriesDatesSet(),
  ]);

  /*
    "Includes £X of …, plus …" on each card (owner, 2026-10-29, from Elaine's
    "show the value"). Only parts with a price of their own are added up: a
    whole series at its price, and the Level One retreat where a tier includes
    retreats. Playlists and the Q&A are never sold alone, so they are named,
    not given a figure: a "worth" made of prices nobody has paid would be a
    misleading reference price. All read from the prices on sale, so a price
    changed in admin moves the line. The LOWEST series price is used, so the
    figure is never more than a member could have paid.
  */
  const seriesPrices = (
    await Promise.all(series.map((s) => optionGroup(`group-coaching-${s.slug}`)))
  ).flatMap((group) => group.filter((o) => (o.credits ?? 1) > 1).map((o) => o.amount));
  const seriesPrice = seriesPrices.length > 0 ? Math.min(...seriesPrices) : null;
  const levelOne = retreats
    .filter((r) => r.level === 1)
    .flatMap((r) => r.prices.filter((p) => p.billing_type === "one_time").map((p) => p.amount));
  const retreatPrice = levelOne.length > 0 ? Math.min(...levelOne) : null;
  const currency = tiers.flatMap((t) => t.prices)[0]?.currency ?? "GBP";

  const includesOf = (tier: MembershipTier): PricedTier["includes"] => {
    if (tier.seriesAllowance == null || seriesPrice == null) return null;
    const retreat = tier.includesRetreats && retreatPrice != null ? retreatPrice : 0;
    const amount = tier.seriesAllowance * seriesPrice + retreat;
    if (amount <= 0) return null;
    const extras = [
      tier.playlistAllowance == null
        ? "every video playlist"
        : tier.playlistAllowance === 1
          ? "a video playlist"
          : tier.playlistAllowance > 1
            ? `${tier.playlistAllowance} video playlists`
            : null,
      tier.includesQa ? "the monthly Q&A" : null,
    ].filter((x): x is string => Boolean(x));
    return {
      amount: formatPrice(amount, currency),
      of: retreat > 0 ? "of coaching and retreats" : "of Group Coaching",
      plus: extras.length > 0 ? `plus ${extras.join(" and ")}` : null,
    };
  };

  /*
    Each card shows its tier's OWN FULL LIST, exactly as stored (migration
    0012). Two earlier approaches were both wrong: a card of only what the tier
    adds hid most of what a Platinum member gets, and a list built by walking
    the ladder said the same thing twice at different sizes ("one playlist" and
    "every playlist" on one card). A higher tier supersedes the lines below it,
    so each tier now reads complete in itself, with no "everything in Silver".
  */
  const priced: PricedTier[] = tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    slug: tier.slug,
    rank: tier.rank,
    prices: tier.prices,
    benefits: tier.benefits,
    includes: includesOf(tier),
    oneToOneDiscount: tier.oneToOneDiscount,
  }));

  return (
    <>
    <Section>
      <Container>
        <PageHeader
          split
          eyebrow="Coaching Pass"
          title="A year of coaching, in one pass"
          // Two lines on every phone (owner, 2026-11-03): eased down from 40px only
          // where "A year of coaching," would otherwise break, below 390px.
          titleClassName="max-sm:text-[clamp(2rem,10.3vw,2.5rem)]"
          description="Live Group Coaching, a video library that keeps growing and, from Gold, a monthly Q&A with Tony, together in one payment for twelve months."
        />

        {/* No series has dates yet: the passes stay on sale, and say so
            (owner, 2026-11-10). Gone by itself once a series has dates. */}
        {!datesSet && series.length > 0 ? (
          <p className="mx-auto mb-8 max-w-2xl rounded-(--radius) border border-border bg-surface px-4 py-3 text-center text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Series dates to be advised.</span> You can buy your pass
            now; as soon as a Group Coaching series has dates, pass holders can register for it ahead of everyone else.
          </p>
        ) : null}

        <MembershipPricing tiers={priced} />

        <div className="measure mx-auto mt-12 space-y-3 text-center text-sm text-muted-foreground">
          <p>
            A Coaching Pass is one payment for twelve months. During your year,
            join your series as each one opens for registration, ahead of
            everyone else. No subscription, nothing auto-renews:
            when the year ends you can buy another.
          </p>
          <p>
            Private coaching, Interactive Cohorts and courses are separate from
            the Coaching Pass and are bought on their own.
          </p>
        </div>

        {/* Elaine's questions, answered from the rules themselves (owner,
            2026-11-02): the same list as on each pass's page. */}
        <FaqBlock items={passFaqs(tiers)} />
      </Container>
    </Section>

    </>
  );
}
