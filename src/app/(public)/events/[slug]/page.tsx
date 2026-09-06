import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/Container";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { formatEventDate, getEvent } from "@/lib/content/events";

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  return event
    ? { title: event.name, description: event.description ?? undefined }
    : { title: "Not found" };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  return (
    <Section>
      <Container width="narrow">
        <BackLink href="/events">All events</BackLink>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <p className="text-sm tracking-wide text-accent uppercase">
              {formatEventDate(event.starts_at, event.ends_at)}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {event.name}
            </h1>
            {event.location ? (
              <p className="text-muted-foreground">{event.location}</p>
            ) : null}
          </div>

          {event.description ? (
            <p className="text-lg leading-relaxed text-pretty">{event.description}</p>
          ) : null}

          <dl className="grid gap-4 rounded-(--radius) border border-border bg-surface p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Price</dt>
              <dd className="mt-1 font-medium">
                {event.is_free ? "Free to attend" : "Ticketed"}
              </dd>
            </div>
            {event.capacity ? (
              <div>
                <dt className="text-sm text-muted-foreground">Capacity</dt>
                <dd className="mt-1 font-medium">{event.capacity} places</dd>
              </div>
            ) : null}
          </dl>

          {/*
            A free event still produces a booking, because capacity and
            attendance must be tracked (note 03 §8.1). Registration itself
            arrives with the booking stage.
          */}
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/bookings?event=${event.slug}`}>
              Register a place
            </ButtonLink>
            <ButtonLink href="/contact" variant="outline">
              Ask a question
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
