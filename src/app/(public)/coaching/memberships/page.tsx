import type { Metadata } from "next";

import {
  MembershipPricing,
  type PricedTier,
} from "@/app/(public)/coaching/memberships/MembershipPricing";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { effectiveBenefits, listMembershipTiers } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Membership",
  description:
    "Silver, Gold, Platinum and Ultimate Membership — each tier includes everything in the one below.",
};

/**
 * Flattening cumulative benefits verbatim produces one real seam: every
 * tier restates its Group Coaching series COUNT as its own line ("One
 * Group Coaching series", "Two…", "All four…"), because that is the one
 * benefit each tier doesn't just ADD to but supersedes — Gold's card
 * showing both Silver's "One" and its own "Two" reads as contradictory,
 * not additive, unlike playlist access or Q&A, which genuinely stack.
 * Keeps only the highest-tier statement of that one fact; every other
 * benefit passes through untouched, in order.
 */
function cumulativeBenefitLabels(benefits: { fromRank: number; label: string }[]): string[] {
  const seriesCountRe = /Group Coaching series/i;
  const lastSeriesCountIndex = benefits.reduce(
    (lastIndex, b, i) => (seriesCountRe.test(b.label) ? i : lastIndex),
    -1,
  );
  return benefits
    .filter((b, i) => !seriesCountRe.test(b.label) || i === lastSeriesCountIndex)
    .map((b) => b.label);
}

export default async function MembershipsPage() {
  const tiers = await listMembershipTiers();

  /*
    Each card shows its full CUMULATIVE benefit set — Gold's card includes
    Silver's series, Platinum's includes Gold's and Silver's, and so on — but
    never says so in words. Tried the opposite first (own-tier benefits only,
    note 07 §10) and reversed it the same day: a Platinum card listing only
    "virtual retreats" while hiding the sixteen sessions and full playlist
    library it also includes told a customer less than the truth. The rule
    now is: extract the substance, never write the sentence. No "Everything
    in Silver, plus" — the labels themselves are just flattened into one
    list, with no per-item marker for which tier introduced them, since that
    distinction is what the "plus" framing was doing in the first place.
  */
  const priced: PricedTier[] = tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    slug: tier.slug,
    rank: tier.rank,
    prices: tier.prices,
    benefits: cumulativeBenefitLabels(effectiveBenefits(tiers, tier)),
  }));

  return (
    <>
    <Section>
      <Container>
        <PageHeader
          eyebrow="Membership"
          title="Four tiers, each one built on the last"
          description="Choosing Gold does not replace Silver — it adds to it. Pick a billing period and compare what each tier actually includes."
          align="center"
        />

        <MembershipPricing tiers={priced} />

        <p className="measure mx-auto mt-12 text-center text-sm text-muted-foreground">
          Membership grants access to what its tier includes. It does not make
          every premium service free — where a service is covered you will not be
          charged again for it; where it is not, it is bought separately.
        </p>
      </Container>
    </Section>

    </>
  );
}
