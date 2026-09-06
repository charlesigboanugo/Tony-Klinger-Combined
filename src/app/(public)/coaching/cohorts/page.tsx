import type { Metadata } from "next";


import { OfferCard } from "@/components/coaching/OfferCard";
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
          description="A structured programme with a fixed group and fixed dates."
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            ["8", "workshops"],
            ["3 hrs", "each"],
            ["24 hrs", "in total"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-(--radius) border border-border bg-surface p-5">
              <p className="text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Cohorts are NOT Group Coaching under another name (note 07 §16), and
            a cohort *level* is not a membership *tier* (note 07 §16.1). */}
        <div className="mb-8 rounded-(--radius) border border-border bg-surface p-6">
          <h2 className="font-medium">How this differs from Group Coaching</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Group Coaching is a series of one-hour sessions you book as you go.
            A cohort is a fixed programme: the same group, eight three-hour
            workshops, start to finish.
          </p>
        </div>

        {cohorts.length === 0 ? (
          <EmptyState
            title="No cohorts scheduled"
            description="New cohort dates are announced here."
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                />
              </Reveal>
            ))}
          </ul>
        )}

      </Container>
    </Section>
  );
}
