import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { listRetreats } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Retreats",
  description: "Immersive retreats with limited places.",
};

export default async function RetreatsPage() {
  const retreats = await listRetreats();

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Retreats"
          description="Immersive, limited places — some by application."
        />

        {retreats.length === 0 ? (
          <EmptyState
            title="No retreats scheduled"
            description="Dates and applications open here."
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {retreats.map((retreat, i) => (
              <Reveal as="li" key={retreat.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/retreats/${retreat.slug}`}
                  title={retreat.name}
                  description={retreat.description}
                  eyebrow={retreat.requires_application ? "By application" : "Retreat"}
                  meta={[
                    retreat.starts_at
                      ? new Date(retreat.starts_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : null,
                    retreat.capacity ? `${retreat.capacity} places` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  storagePath={retreat.storagePath}
                  seed={retreat.slug}
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
