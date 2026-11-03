import type { Metadata } from "next";


import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { FaqBlock } from "@/components/content/FaqList";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { phaseStatus, placesLabel } from "@/lib/content/offer-status";
import { listCohorts, listIntakes } from "@/lib/content/coaching";
import { cohortFaqs } from "@/lib/content/product-faqs";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Interactive Cohorts",
  description:
    "Eight workshops of three hours — twenty-four hours together.",
  path: "/coaching/cohorts",
});

export default async function CohortsPage() {
  const cohorts = await listCohorts();

  // The cohorts are fixed; their intakes say when each is next on and whether
  // it can be joined (migration 0017).
  const intakes = await listIntakes(cohorts.map((c) => c.id));
  const day = (value: string) =>
    new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  // When it is on, as the chip on the card's photograph; the intake and its
  // dates as facts under the title.
  const statusOf = (cohortId: string) => phaseStatus(intakes.filter((i) => i.cohortId === cohortId));
  // The details on each card, under the title (owner, 2026-11-03).
  const factsOf = (cohortId: string) => {
    // The intake the status chip speaks of: open, then coming, then under way.
    const mine = intakes.filter((i) => i.cohortId === cohortId);
    const intake =
      mine.find((i) => i.state === "open") ??
      mine.find((i) => i.state === "full" || i.state === "upcoming") ??
      mine[0];
    return [
      ...(intake
        ? [{ icon: "calendar" as const, text: `${intake.label}: ${day(intake.startsAt)} to ${day(intake.endsAt)}` }]
        : []),
      { icon: "count" as const, text: "Eight three-hour workshops" },
    ];
  };

  return (
    <Section>
      <Container>
        <PageHeader
          split
          eyebrow="Coaching"
          title="Interactive Cohorts"
          description="A fixed programme with a fixed group: eight three-hour workshops, live on Zoom, start to finish with the same people. Unlike Group Coaching, you do not book session by session."
        />

        {/* Cohorts are NOT Group Coaching under another name (note 07 §16), and
            a cohort *level* is not a membership *tier* (note 07 §16.1). The
            difference is stated in the header rather than in a boxed aside;
            the old "8 / 3 hrs / 24 hrs" figure tiles are gone (owner: no
            count stats). */}
        {cohorts.length === 0 ? (
          <EmptyState
            title="No cohorts yet"
            description="Cohorts are announced here."
          />
        ) : (
          <OfferGrid count={cohorts.length}>
            {cohorts.map((cohort, i) => (
              <Reveal as="li" key={cohort.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/cohorts/${cohort.slug}`}
                  title={cohort.name}
                  description={cohort.description}
                  /* Always labelled a COHORT level, never a bare "Gold" — the
                     two ladders share three names and must not be conflated
                     (note 07 §16.1). */
                  eyebrow={`${cohort.cohort_level} cohort`}
                  cta="View cohort"
                  status={statusOf(cohort.id)}
                  places={placesLabel(intakes.filter((i) => i.cohortId === cohort.id))}
                  facts={factsOf(cohort.id)}
                  prices={cohort.prices}
                  storagePath={cohort.storagePath}
                  seed={cohort.slug}
                  priority={i < 3}
                  feature={cohorts.length === 1}
                />
              </Reveal>
            ))}
          </OfferGrid>
        )}


        {/* The questions on every cohort's page, here too (owner, 2026-11-02). */}
        {cohorts.length > 0 ? <FaqBlock items={cohortFaqs()} /> : null}
      </Container>
    </Section>
  );
}
