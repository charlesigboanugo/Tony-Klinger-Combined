import type { Metadata } from "next";
import Link from "next/link";

import { NewsletterSignup } from "@/components/content/NewsletterSignup";
import { Container } from "@/components/layout/Container";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  eventDay,
  eventLeaf,
  eventTime,
  listEventsByTime,
  type PublicEvent,
} from "@/lib/content/events";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Talks, screenings, Q&As and live sessions with Tony Klinger — what is coming up, and what has been.",
};

/**
 * Events — note 03 §8.1.
 *
 * Set as a programme (owner, 2026-09-26: award-winning, no split hero). A noir
 * title card with the next date on it, then the programme: the soonest event
 * as a wide billing, the rest as a row of billings, each with its photograph
 * where the event has one (migration 0017) and a date leaf where it has not.
 * Past events follow as an archive, most recent first, so the page still
 * shows Tony's public life on a week with nothing announced.
 */
export default async function EventsPage() {
  const { upcoming, past } = await listEventsByTime();
  const [next, ...later] = upcoming;

  return (
    <>
      <section className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground">
        {/* A projector's pool of light behind the title — no photo needed. */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -z-10 h-[140%] w-[min(70rem,140vw)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--block-foreground)_14%,transparent),transparent_62%)]"
        />
        <Container className="pt-14 pb-16 text-center sm:pt-18 sm:pb-20 lg:pt-[max(3.5rem,calc(var(--hero-text-top)-1.5rem))] lg:pb-24">
          <Reveal className="mx-auto max-w-3xl">
            <Eyebrow align="center" className="text-block-foreground/80">In person and online</Eyebrow>
            <h1 className="mt-5">Events</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-block-foreground/85 text-pretty">
              Talks, screenings, Q&amp;As and live sessions: where to hear Tony
              tell the stories, and ask him your own questions.
            </p>
          </Reveal>

          {next ? (
            <Reveal delay={120} className="mt-10">
              <Link
                href={`/events/${next.slug}`}
                className="group inline-flex max-w-full items-center gap-3 rounded-full border border-block-foreground/25 bg-block-foreground/5 py-2 pr-5 pl-2 text-left text-sm transition-colors hover:border-block-foreground/50 hover:bg-block-foreground/10"
              >
                <span className="shrink-0 rounded-full bg-button px-3 py-1 text-xs font-semibold tracking-[0.08em] text-button-foreground uppercase">
                  Next
                </span>
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{next.name}</span>
                  <span className="text-block-foreground/70">
                    {" · "}
                    {next.starts_at ? eventDay(next.starts_at) : "Date to be announced"}
                  </span>
                </span>
                <span aria-hidden="true" className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none">
                  &rarr;
                </span>
              </Link>
            </Reveal>
          ) : null}
        </Container>
      </section>

      {/* THE PROGRAMME */}
      <section aria-labelledby="upcoming-heading" className="py-18 sm:py-24">
        <Container>
          <Eyebrow>Coming up</Eyebrow>
          <h2 id="upcoming-heading" className="mt-5 font-display">
            {upcoming.length > 0 ? "On the programme." : "No dates announced yet."}
          </h2>

          {next ? (
            <>
              <Reveal className="mt-10 sm:mt-12">
                <FeatureBilling event={next} />
              </Reveal>
              {later.length > 0 ? (
                <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {later.map((event, i) => (
                    <Reveal as="li" key={event.id} delay={(i % 3) * 60}>
                      <Billing event={event} />
                    </Reveal>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <Reveal className="mt-10 grid gap-10 border-t border-foreground/15 pt-10 sm:mt-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground text-pretty">
                  New talks and screenings are announced here and in the
                  newsletter first. Leave your email and you will hear as soon
                  as a date is set.
                </p>
                <div className="mt-6 max-w-md">
                  <NewsletterSignup variant="compact" />
                </div>
              </div>
              <div className="lg:border-l lg:border-foreground/15 lg:pl-16">
                <h3 className="font-display text-xl font-semibold">Bring Tony to your audience</h3>
                <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                  Festivals, film societies, schools and screenings: ask about a
                  talk or a Q&amp;A with Tony.
                </p>
                <ButtonLink href="/contact" variant="outline" className="mt-6">
                  Get in touch
                  <ButtonArrow />
                </ButtonLink>
              </div>
            </Reveal>
          )}
        </Container>
      </section>

      {/* THE ARCHIVE — most recent first. */}
      {past.length > 0 ? (
        <section aria-labelledby="past-heading" className="border-t border-border bg-surface-muted py-18 sm:py-24">
          <Container>
            <Eyebrow>The archive</Eyebrow>
            <h2 id="past-heading" className="mt-5 font-display">Past events.</h2>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
              {past.map((event, i) => (
                <Reveal as="li" key={event.id} delay={(i % 4) * 50}>
                  <Billing event={event} past />
                </Reveal>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Close: the same invitation, whether or not dates are announced. */}
      {upcoming.length > 0 ? (
        <section className="border-t border-border py-15 sm:py-21">
          <Container className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display">Bring Tony to your audience.</h2>
              <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
                Festivals, film societies, schools and screenings: ask about a
                talk or a Q&amp;A.
              </p>
            </div>
            <ButtonLink href="/contact" size="lg">
              Get in touch
              <ButtonArrow />
            </ButtonLink>
          </Container>
        </section>
      ) : null}
    </>
  );
}

/** Where, when and what it costs, in one quiet line. */
function priceLabel(event: PublicEvent) {
  return event.is_free ? "Free · registration required" : "Ticketed";
}

/**
 * The frame an event is shown in: its photograph, or — when it has none — a
 * noir leaf with the date set large, so a row never has an empty hole.
 */
function Frame({ event, sizes, priority, past }: { event: PublicEvent; sizes: string; priority?: boolean; past?: boolean }) {
  const leaf = event.starts_at ? eventLeaf(event.starts_at) : null;
  return (
    <div className="relative aspect-3/2 overflow-hidden rounded-sm bg-block-noir text-block-foreground">
      {event.storagePath ? (
        <StoredImage
          path={event.storagePath}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className={cn(
            "transition-[transform,filter] duration-(--dur-slow) ease-expo group-hover:scale-[1.03] motion-reduce:transition-none",
            past && "grayscale-[0.6] group-hover:grayscale-0",
          )}
        />
      ) : (
        <div aria-hidden="true" className="grain grid size-full place-items-center">
          {leaf ? (
            <span className="text-center">
              <span className="block font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-none font-semibold">{leaf.day}</span>
              <span className="mt-2 block text-xs font-semibold tracking-[0.2em] uppercase opacity-75">{leaf.month} {leaf.year}</span>
            </span>
          ) : (
            <span className="text-xs font-semibold tracking-[0.2em] uppercase opacity-75">Date to come</span>
          )}
        </div>
      )}
      {/* The date leaf pinned on a photograph, so the date reads at a glance. */}
      {event.storagePath && leaf ? (
        <span className="absolute top-3 left-3 rounded-sm bg-block-noir/85 px-2.5 py-1.5 text-center leading-none backdrop-blur-sm">
          <span className="block font-display text-lg font-semibold">{leaf.day}</span>
          <span className="mt-1 block text-[0.625rem] font-semibold tracking-[0.16em] uppercase opacity-80">{leaf.month}</span>
        </span>
      ) : null}
    </div>
  );
}

/** The soonest event, as a wide billing: frame beside its details from lg. */
function FeatureBilling({ event }: { event: PublicEvent }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group grid gap-8 border-t border-foreground/15 pt-8 focus-visible:outline-offset-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14"
    >
      <Frame event={event} sizes="(min-width: 1024px) 58vw, 100vw" priority />
      <div>
        <p className="text-sm font-semibold tracking-[0.08em] text-primary uppercase">
          {event.starts_at ? eventDay(event.starts_at) : "Date to be announced"}
        </p>
        <h3 className="mt-4 font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-tight font-semibold text-balance">
          {event.name}
        </h3>
        {event.description ? (
          <p className="mt-4 line-clamp-3 leading-relaxed text-muted-foreground">{event.description}</p>
        ) : null}
        <dl className="mt-6 space-y-1.5 text-sm">
          {event.starts_at ? (
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-muted-foreground">Time</dt><dd>{eventTime(event.starts_at, event.ends_at)}</dd></div>
          ) : null}
          {event.location ? (
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-muted-foreground">Where</dt><dd>{event.location}</dd></div>
          ) : null}
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-muted-foreground">Entry</dt><dd>{priceLabel(event)}</dd></div>
        </dl>
        <span className="mt-8 inline-flex items-center gap-2 font-semibold text-primary">
          Event details
          <span aria-hidden="true" className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1.5 motion-reduce:transform-none">&rarr;</span>
        </span>
      </div>
    </Link>
  );
}

/** One billing in a row: frame, date, name, place. */
function Billing({ event, past }: { event: PublicEvent; past?: boolean }) {
  return (
    <Link href={`/events/${event.slug}`} className="group block focus-visible:outline-offset-4">
      <Frame
        event={event}
        past={past}
        sizes={past ? "(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"}
      />
      <p className="mt-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {event.starts_at ? eventDay(event.starts_at) : "Date to be announced"}
      </p>
      <h3 className={cn("mt-2 font-display leading-snug font-semibold text-balance transition-colors group-hover:text-primary", past ? "text-lg" : "text-xl")}>
        {event.name}
      </h3>
      {event.location ? <p className="mt-1.5 text-sm text-muted-foreground">{event.location}</p> : null}
      {past ? null : <p className="mt-3 text-sm font-medium">{priceLabel(event)}</p>}
    </Link>
  );
}
