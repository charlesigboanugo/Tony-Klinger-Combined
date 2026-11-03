import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { FaqBlock } from "@/components/content/FaqList";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { datedStatus, placesLabel } from "@/lib/content/offer-status";
import { listMembershipTiers, listRetreats } from "@/lib/content/coaching";
import { retreatsOverviewFaqs } from "@/lib/content/product-faqs";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Retreats",
  description:
    "The Virtual Retreat: a day online with working mentors, at three levels, from watching the sessions to pitching your own project.",
  path: "/coaching/retreats",
});


export default async function RetreatsPage() {
  const [retreats, tiers] = await Promise.all([listRetreats(), listMembershipTiers()]);

  return (
    <Section>
      <Container>
        <PageHeader
          split
          eyebrow="Coaching"
          title="Retreats"
          description="A day online with working mentors. Join at the level that suits you: watch the sessions, bring your own project for feedback, or pitch it to the panel."
        />

        {retreats.length === 0 ? (
          <EmptyState
            title="No retreats announced"
            description="The next retreat will be announced here."
          />
        ) : (
          <OfferGrid count={retreats.length}>
            {retreats.map((retreat, i) => (
              <Reveal as="li" key={retreat.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/retreats/${retreat.slug}`}
                  title={retreat.name}
                  description={retreat.description}
                  eyebrow={retreat.inProgress ? "In progress" : retreat.requires_application ? "By interview" : "Open to all"}
                  cta="View level"
                  prices={retreat.prices}
                  // Where a retreat has no product yet, say how it is entered
                  // in the place the price would be.
                  priceLabel={retreat.prices.length === 0 && retreat.requires_application ? "By interview" : undefined}
                  status={datedStatus({ startsAt: retreat.starts_at, endsAt: retreat.ends_at, inProgress: retreat.inProgress, endedAt: retreat.endedAt, nextOpenAt: retreat.nextOpenAt, batches: retreat.batches })}
                  places={placesLabel(retreat.batches)}
                  storagePath={retreat.storagePath}
                  seed={retreat.slug}
                  priority={i < 3}
                  feature={retreats.length === 1}
                />
              </Reveal>
            ))}
          </OfferGrid>
        )}

        {/* Every level's questions at once; a pass's free entry is to Level One
            only (owner, 2026-11-02). */}
        {retreats.length > 0 ? (
          <FaqBlock
            items={retreatsOverviewFaqs({
              passNames: tiers.filter((t) => t.includesRetreats && t.prices.length > 0).map((t) => t.name),
            })}
          />
        ) : null}
      </Container>
    </Section>
  );
}
