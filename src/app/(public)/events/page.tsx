import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventDate, listEventsByTime } from "@/lib/content/events";

export const metadata: Metadata = {
  title: "Events",
  description: "Talks, screenings and live sessions with Tony Klinger.",
};

export default async function EventsPage() {
  const { upcoming, past } = await listEventsByTime();

  return (
    <Section>
      <Container>
        <PageHeader title="Events" description="Where to see Tony in person and online." />

        {upcoming.length === 0 ? (
          <EmptyState
            title="No events scheduled"
            description="Nothing is on the calendar right now. New dates are announced here first."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="group flex h-full flex-col rounded-(--radius) border border-border bg-surface p-6 transition-colors hover:border-accent"
                >
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {formatEventDate(event.starts_at, event.ends_at)}
                  </p>
                  <h2 className="mt-2 text-lg font-medium group-hover:text-accent">
                    {event.name}
                  </h2>
                  {event.location ? (
                    <p className="mt-1 text-sm text-muted-foreground">{event.location}</p>
                  ) : null}
                  <p className="mt-4 text-sm font-medium">
                    {event.is_free ? "Free — registration required" : "Ticketed"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-medium text-muted-foreground">Past events</h2>
            <ul className="divide-y divide-border border-y border-border">
              {past.map((event) => (
                <li key={event.id} className="py-4">
                  <Link href={`/events/${event.slug}`} className="hover:text-accent">
                    {event.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatEventDate(event.starts_at, event.ends_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
