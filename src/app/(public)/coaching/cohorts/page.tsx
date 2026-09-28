import type { Metadata } from "next";


import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { listCohorts } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Interactive Cohorts",
  description: "Eight workshops of three hours — twenty-four hours together.",
};

export default async function CohortsPage() {
  const cohorts = await listCohorts();

  return (
    <Section>
      <Container>
        <PageHeader
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
            title="No cohorts scheduled"
            description="New cohort dates are announced here."
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
                  meta={
                    cohort.starts_at
                      ? `Starts ${new Date(cohort.starts_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}`
                      : "Dates to be announced"
                  }
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

      </Container>
    </Section>
  );
}
