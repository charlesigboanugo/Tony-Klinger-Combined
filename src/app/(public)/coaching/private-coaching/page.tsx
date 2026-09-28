import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { listCoachingServices } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Private Coaching",
  description: "One-to-one coaching with Tony Klinger.",
};

export default async function PrivateCoachingPage() {
  const services = await listCoachingServices();

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Private Coaching"
          description="One to one, scheduled around you. Buy a session, then book the time that suits you."
        />

        {services.length === 0 ? (
          <EmptyState
            title="No services published yet"
            description="Private coaching availability is announced here."
          />
        ) : (
          <OfferGrid count={services.length}>
            {services.map((service, i) => (
              <Reveal as="li" key={service.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/private-coaching/${service.slug}`}
                  title={service.name}
                  description={service.description}
                  eyebrow="One to one"
                  cta="View and book"
                  meta={`${service.duration_minutes} minutes`}
                  prices={service.prices}
                  storagePath={service.storagePath}
                  seed={service.slug}
                  priority={i < 3}
                  feature={services.length === 1}
                />
              </Reveal>
            ))}
          </OfferGrid>
        )}

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Membership covers private coaching only where that benefit is stated
          explicitly. Where it is not, private sessions are bought separately.
        </p>
      </Container>
    </Section>
  );
}
