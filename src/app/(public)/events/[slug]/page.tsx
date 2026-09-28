import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
  PurchasePanel,
} from "@/components/coaching/ProductPage";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { formatPrice } from "@/lib/commerce/pricing";
import {
  FORMAT_LABEL,
  eventDay,
  eventDayShort,
  eventTime,
  eventViewer,
  getEvent,
  hasStarted,
  type EventDetail,
  type EventViewer,
} from "@/lib/content/events";
import { cn } from "@/lib/utils/cn";

import { leaveWaitlistAction } from "./actions";
import { RegisterButton, WaitlistButton } from "./RegisterButton";

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  return event
    ? { title: event.name, description: event.description ?? undefined }
    : { title: "Not found" };
}

/**
 * One event — note 03 §8.1, set on the shared product page (the coaching
 * pages' structure, which the owner approved): the event's photograph as a
 * full-bleed hero, a facts row, a reading column, the photographs from the
 * event, and a panel that says plainly whether and how to get a place.
 *
 * The page answers what the note asks of it: what the event is, when and
 * where, whether a place must be registered, whether payment is required,
 * and how many places are left.
 */
export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  const viewer = await eventViewer(event.id);

  const past = hasStarted(event);
  const left = event.capacity ? Math.max(event.capacity - event.taken, 0) : null;
  const full = left === 0;
  const paragraphs = (event.description ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const price = event.ticket ? formatPrice(event.ticket.price.amount, event.ticket.price.currency) : null;
  const inPerson = event.format !== "online";
  const online = event.format !== "in_person";

  const facts = [
    // Compact forms here: five facts must sit in three aligned columns
    // without wrapping; the hero and the panel carry the full wording.
    { label: "Date", value: event.starts_at ? eventDayShort(event.starts_at) : "To be announced" },
    ...(event.starts_at ? [{ label: "Time", value: `${eventTime(event.starts_at, event.ends_at)} UK` }] : []),
    { label: "Format", value: FORMAT_LABEL[event.format] },
    ...(event.location ? [{ label: "Where", value: event.location }] : []),
    {
      label: "Entry",
      value: event.is_free ? "Free" : price ? `${price} a ticket` : "Ticketed",
    },
  ];

  // The phone's pinned bar only when there is one obvious next step.
  const bar =
    past || viewer.booking || full || !event.starts_at
      ? null
      : event.is_free
        ? { label: "Register a free place", href: "#register", price: null }
        : event.ticket
          ? { label: "Buy a ticket", href: `/checkout?event=${event.ticket.productSlug}`, price }
          : null;

  const link = "font-medium text-foreground underline underline-offset-4 hover:text-accent";

  return (
    <>
      <ProductHero
        backHref="/events"
        backLabel="All events"
        eyebrow={past ? "Past event" : event.starts_at ? eventDay(event.starts_at) : "Date to be announced"}
        title={event.name}
        description={paragraphs[0] ?? null}
        cover={{ path: event.storagePath }}
        price={past ? null : event.is_free ? "Free" : price}
        priceNote={past ? null : event.is_free ? "register a place" : price ? "a ticket" : null}
      />

      <ProductLayout aside={<Panel event={event} viewer={viewer} past={past} left={left} full={full} price={price} />}>
        <ProductFacts facts={facts} />

        {paragraphs.length > 1 ? (
          <ProductSection title="About the event">
            <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-pretty">
              {paragraphs.slice(1).map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </ProductSection>
        ) : null}

        {!past && (inPerson || online) ? (
          <ProductSection title={event.format === "hybrid" ? "Two ways to attend" : inPerson ? "Getting there" : "Joining online"}>
            <div className={cn("grid gap-8", event.format === "hybrid" && "sm:grid-cols-2")}>
              {inPerson ? (
                <div>
                  {event.format === "hybrid" ? <h3 className="font-display text-xl font-semibold">In the room</h3> : null}
                  <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">
                    {event.venue_address ?? event.location ?? "The venue is confirmed on your ticket."}
                  </p>
                  {event.venue_address ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn("mt-3 inline-block text-sm", link)}
                    >
                      Open in Maps
                    </a>
                  ) : null}
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Show the QR code on your ticket, or its reference, at the door.
                  </p>
                </div>
              ) : null}
              {online ? (
                <div>
                  {event.format === "hybrid" ? <h3 className="font-display text-xl font-semibold">From anywhere</h3> : null}
                  <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">
                    The joining link is on your ticket once you have a place, and we
                    email it to you again shortly before the start.
                  </p>
                </div>
              ) : null}
            </div>
          </ProductSection>
        ) : null}

        {event.gallery.length > 0 ? <Gallery event={event} past={past} /> : null}

        <ProductSection title={past ? "Missed it?" : "Good to know"}>
          <ul className="max-w-2xl space-y-3 leading-relaxed text-muted-foreground">
            {past ? (
              <>
                <li>
                  New dates are announced on the <Link href="/events" className={link}>events page</Link>{" "}
                  and in the newsletter first.
                </li>
                <li>
                  To bring Tony to your own audience, <Link href="/contact" className={link}>get in touch</Link>.
                </li>
              </>
            ) : (
              <>
                <li>All times are UK time. We send a reminder the day before.</li>
                <li>
                  Every place comes with a ticket and a reference code, in your
                  inbox and under your account&apos;s bookings.
                </li>
                {event.is_free ? (
                  <li>Can no longer come? Cancel from your bookings, so the place goes to the next person waiting.</li>
                ) : (
                  <li>
                    Can no longer come? <Link href="/contact" className={link}>Get in touch</Link> about your
                    ticket; see the <Link href="/terms#cancellation" className={link}>cancellation terms</Link>.
                  </li>
                )}
                {event.capacity ? <li>If every place is taken, join the waiting list and we will email you if one opens.</li> : null}
              </>
            )}
          </ul>
        </ProductSection>
      </ProductLayout>

      {bar ? <MobileBuyBar price={bar.price} href={bar.href} label={bar.label} /> : null}
    </>
  );
}

/** What a visitor can do about a place, stated plainly for every state. */
function Panel({
  event,
  viewer,
  past,
  left,
  full,
  price,
}: {
  event: EventDetail;
  viewer: EventViewer;
  past: boolean;
  left: number | null;
  full: boolean;
  price: string | null;
}) {
  if (past) {
    return (
      <PurchasePanel footnote="New dates are announced on the events page first.">
        <p className="font-display text-2xl font-semibold">This event has taken place.</p>
        <ButtonLink href="/events" className="mt-6 w-full">
          See what&apos;s coming up
          <ButtonArrow />
        </ButtonLink>
      </PurchasePanel>
    );
  }

  if (viewer.booking) {
    return (
      <div id="register" className="scroll-mt-28">
        <PurchasePanel footnote="Your ticket has the QR code for the door and, for online events, the joining link.">
          <p className="text-sm font-semibold text-accent">You have a place</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-wider">{viewer.booking.reference}</p>
          <ButtonLink href={`/account/tickets/${viewer.booking.id}`} className="mt-6 w-full">
            View my ticket
            <ButtonArrow />
          </ButtonLink>
        </PurchasePanel>
      </div>
    );
  }

  const availability =
    left === null ? null : full ? "Fully booked" : `${left} ${left === 1 ? "place" : "places"} left`;

  let action: React.ReactNode;
  if (!event.starts_at) {
    action = (
      <>
        <p className="leading-relaxed text-muted-foreground">Places open once the date is confirmed.</p>
        <ButtonLink href="/contact" variant="outline" className="mt-6 w-full">
          Ask to be told
        </ButtonLink>
      </>
    );
  } else if (full) {
    action =
      viewer.waitlistPosition !== null ? (
        <form action={leaveWaitlistAction} className="space-y-4">
          <p className="leading-relaxed">
            You&apos;re on the waiting list, <strong>number {viewer.waitlistPosition}</strong>. If a
            place opens we will email you straight away.
          </p>
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="slug" value={event.slug} />
          <button type="submit" className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-accent">
            Leave the waiting list
          </button>
        </form>
      ) : (
        <WaitlistButton eventId={event.id} slug={event.slug} />
      );
  } else if (event.is_free) {
    action = <RegisterButton eventId={event.id} slug={event.slug} />;
  } else if (event.ticket) {
    action = viewer.signedIn ? (
      <ButtonLink href={`/checkout?event=${event.ticket.productSlug}`} className="w-full">
        Buy a ticket
        <ButtonArrow />
      </ButtonLink>
    ) : (
      <>
        <ButtonLink href={`/auth/sign-in?next=${encodeURIComponent(`/events/${event.slug}#register`)}`} className="w-full">
          Sign in to buy a ticket
        </ButtonLink>
        <ButtonLink href={`/auth/sign-up?next=${encodeURIComponent(`/events/${event.slug}#register`)}`} variant="outline" className="mt-3 w-full">
          Create a free account
        </ButtonLink>
      </>
    );
  } else {
    // Ticketed, but no ticket product is on sale (yet): a person arranges it.
    action = (
      <>
        <p className="leading-relaxed text-muted-foreground">Tickets are not on sale online yet.</p>
        <ButtonLink href="/contact" className="mt-6 w-full">
          Ask about tickets
        </ButtonLink>
      </>
    );
  }

  return (
    <div id="register" className="scroll-mt-28">
      <PurchasePanel
        price={event.is_free ? "Free" : price}
        priceNote={event.is_free ? "register a place" : price ? "a ticket" : null}
        footnote={
          full
            ? "Places are offered to the waiting list in the order people joined."
            : "You'll need a free account, so your ticket and any changes reach you."
        }
      >
        {availability ? (
          <p className={cn("mb-5 text-sm font-semibold", full ? "text-primary" : "text-accent")}>{availability}</p>
        ) : null}
        {action}
      </PurchasePanel>
    </div>
  );
}

/**
 * The photographs from the event: the first wide, the rest in a row beneath
 * it. Captions sit under their photograph, not over it.
 */
function Gallery({ event, past }: { event: EventDetail; past: boolean }) {
  const [first, ...rest] = event.gallery;
  return (
    <ProductSection title={past ? "From the event" : "Photographs"}>
      <Reveal className="space-y-4">
        <figure>
          <div className="relative aspect-3/2 overflow-hidden rounded-sm bg-surface-muted">
            <StoredImage path={first.path} alt={first.caption ?? `${event.name}, photograph 1`} fill quality={90} sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
          {first.caption ? <figcaption className="mt-2 text-sm text-muted-foreground">{first.caption}</figcaption> : null}
        </figure>
        {rest.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {rest.map((image, i) => (
              <li key={image.path}>
                <figure>
                  <div className="relative aspect-square overflow-hidden rounded-sm bg-surface-muted">
                    <StoredImage path={image.path} alt={image.caption ?? `${event.name}, photograph ${i + 2}`} fill sizes="(min-width: 1024px) 17vw, 45vw" />
                  </div>
                  {image.caption ? <figcaption className="mt-2 text-sm text-muted-foreground">{image.caption}</figcaption> : null}
                </figure>
              </li>
            ))}
          </ul>
        ) : null}
      </Reveal>
    </ProductSection>
  );
}
