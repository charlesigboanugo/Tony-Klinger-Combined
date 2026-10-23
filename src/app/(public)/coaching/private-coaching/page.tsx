import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { listCoachingServices } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Private Coaching",
  description:
    "One-to-one coaching with Tony Klinger.",
  path: "/coaching/private-coaching",
});

export default async function PrivateCoachingPage() {
  const services = await listCoachingServices();

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Private Coaching"
          description="An hour with Tony on your own project or career, at a time that suits you. Book a single session, or a pack to use when you need them."
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
                  cta="View and buy"
                  meta={`${service.duration_minutes} minutes`}
                  priceNote="a session"
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
          Private coaching is separate from the Coaching Pass: it is booked session
          by session, or bought as a pack.
        </p>
      </Container>
    </Section>
  );
}
