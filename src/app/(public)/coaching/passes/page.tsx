import type { Metadata } from "next";

import {
  MembershipPricing,
  type PricedTier,
} from "@/app/(public)/coaching/passes/MembershipPricing";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { listMembershipTiers } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Coaching Pass",
  description:
    "The Silver, Gold and Platinum Coaching Pass: a year of live Group Coaching with Tony Klinger, a growing video library and a monthly Q&A.",
  path: "/coaching/passes",
});

export default async function MembershipsPage() {
  const tiers = await listMembershipTiers();

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
  }));

  return (
    <>
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching Pass"
          title="A year of coaching, in one pass"
          // Narrower than the block (owner, 2026-10-10), so it sits on two
          // even lines above the text instead of one long one.
          titleClassName="mx-auto max-w-xl text-balance"
          description="Live Group Coaching, a video library that keeps growing and, from Gold, a monthly Q&A with Tony. More for less than buying each part on its own, to use whenever you like within twelve months."
          align="center"
        />

        <MembershipPricing tiers={priced} />

        <div className="measure mx-auto mt-12 space-y-3 text-center text-sm text-muted-foreground">
          <p>
            A Coaching Pass is one payment for twelve months, to use whenever
            you like within the year. It does not renew by itself and nothing
            more is taken: when the year ends you can buy another.
          </p>
          <p>
            Private coaching, Interactive Cohorts and courses are separate from
            the Coaching Pass and are bought on their own.
          </p>
        </div>
      </Container>
    </Section>

    </>
  );
}
