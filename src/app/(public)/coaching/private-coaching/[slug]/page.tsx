import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/Container";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCoachingService } from "@/lib/content/coaching";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/private-coaching/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getCoachingService(slug);
  return service ? { title: service.name, description: service.description ?? undefined } : { title: "Not found" };
}

/** Private coaching service detail — note 07 §37.1: what it is, what it costs,
 * how long, what happens next, all on this page rather than the card alone. */
export default async function PrivateCoachingServicePage({
  params,
}: PageProps<"/coaching/private-coaching/[slug]">) {
  const { slug } = await params;
  const service = await getCoachingService(slug);
  if (!service) notFound();

  const price = service.prices[0] ?? null;

  return (
    <Section>
      <Container width="narrow">
        <BackLink href="/coaching/private-coaching">Private coaching</BackLink>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{service.name}</h1>
            {service.description ? (
              <p className="text-lg text-muted-foreground text-pretty">{service.description}</p>
            ) : null}
          </div>

          <dl className="grid gap-4 rounded-(--radius) border border-border bg-surface p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Length</dt>
              <dd className="mt-1 font-medium">{service.duration_minutes} minutes</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Price</dt>
              <dd className="mt-1 font-medium">
                {price ? formatPrice(price.amount, price.currency) : "Price on application"}
              </dd>
            </div>
          </dl>

          {service.benefits.length > 0 ? (
            <div className="rounded-(--radius) border border-border bg-surface p-6">
              <h2 className="font-medium">What&apos;s included</h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {service.benefits.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span aria-hidden="true" className="text-accent">+</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Cancellation policy, recovered from the coaching site's own
              service page — a real customer-facing fact, not filler. */}
          <p className="text-sm text-muted-foreground">
            To cancel or reschedule, contact us at least 48 hours in advance.
          </p>

          <ButtonLink href={`/bookings/${service.slug}`}>Check availability</ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
