import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { BackLink } from "@/components/ui/BackLink";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { FORMAT_LABEL, eventDay, eventTime } from "@/lib/content/events";
import { getTicket } from "@/lib/content/tickets";
import { requireUser } from "@/lib/permissions";
import { absoluteUrl } from "@/lib/urls";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Your ticket", robots: { index: false } };

/**
 * An event ticket — migration 0018, note 03 §8.1 (booking → attendance).
 *
 * Set like a printed ticket: the event on the left, a perforated stub on the
 * right holding the reference and a QR code. The QR encodes the staff
 * check-in address for this reference, so a phone camera at the door opens
 * the check-in screen directly; for anyone not signed in as staff that
 * screen reveals nothing. The code is always dark on white, whatever the
 * theme, because scanners need the contrast.
 *
 * The joining link for an online event is shown only here and in the
 * reminder emails: `event_access` is readable by ticket holders alone.
 */
export default async function TicketPage({ params }: PageProps<"/account/tickets/[id]">) {
  const { id } = await params;
  await requireUser(`/account/tickets/${id}`);
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const { event } = ticket;
  const cancelled = ticket.status === "cancelled";
  const inPerson = event.format !== "online";
  const online = event.format !== "in_person";
  const qr = await QRCode.toString(absoluteUrl(`/admin/check-in/${ticket.reference}`), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0F1513", light: "#FFFFFF" },
  });

  return (
    <>
      <BackLink href="/account/bookings">All bookings</BackLink>

      <article
        aria-label={`Ticket for ${event.name}`}
        className={cn(
          "mt-6 grid overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-lift md:grid-cols-[minmax(0,1fr)_16rem]",
          cancelled && "opacity-70",
        )}
      >
        <div className="p-7 sm:p-9">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-primary" />
            {cancelled ? "Cancelled" : ticket.checkedInAt ? "Checked in" : "Admit one"} · {FORMAT_LABEL[event.format]}
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            <Link href={`/events/${event.slug}`} className="hover:text-accent">
              {event.name}
            </Link>
          </h1>

          <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">Date</dt>
              <dd className="mt-1 font-semibold">{event.startsAt ? eventDay(event.startsAt) : "To be announced"}</dd>
            </div>
            {event.startsAt ? (
              <div>
                <dt className="text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">Time</dt>
                <dd className="mt-1 font-semibold">{eventTime(event.startsAt, event.endsAt)} UK</dd>
              </div>
            ) : null}
            {inPerson ? (
              <div className="sm:col-span-2">
                <dt className="text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">Venue</dt>
                <dd className="mt-1 font-semibold">{event.venueAddress ?? event.location ?? "To be confirmed"}</dd>
                {event.venueAddress ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm font-medium underline underline-offset-4 hover:text-accent"
                  >
                    Open in Maps
                  </a>
                ) : null}
              </div>
            ) : null}
          </dl>

          {online && !cancelled ? (
            <div className="mt-8 rounded-(--radius) bg-surface-muted p-5">
              <p className="font-semibold">Joining online</p>
              {ticket.joinUrl ? (
                <>
                  <ButtonLink href={ticket.joinUrl} className="mt-3" target="_blank" rel="noopener noreferrer">
                    Join the event
                    <ButtonArrow />
                  </ButtonLink>
                  <p className="mt-3 text-sm break-all text-muted-foreground">{ticket.joinUrl}</p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The joining link will appear here, and we will email it to you
                  before the start.
                </p>
              )}
              {ticket.joiningNotes ? (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{ticket.joiningNotes}</p>
              ) : null}
            </div>
          ) : null}

          {!cancelled && event.startsAt ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/account/tickets/${ticket.id}/calendar`} variant="outline" size="sm">
                Add to calendar
              </ButtonLink>
            </div>
          ) : null}
        </div>

        {/* The stub, torn off along a dashed perforation. */}
        <div className="relative flex flex-col items-center justify-center gap-4 border-t-2 border-dashed border-border bg-block-noir p-7 text-block-foreground md:border-t-0 md:border-l-2">
          {inPerson && !cancelled ? (
            <div
              role="img"
              aria-label={`QR code for ticket ${ticket.reference}`}
              className="size-44 rounded-sm bg-white p-2 [&_svg]:size-full"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : null}
          <div className="text-center">
            <p className="text-[0.6875rem] tracking-[0.16em] text-block-foreground/70 uppercase">Reference</p>
            <p className="mt-1 font-mono text-xl font-semibold tracking-wider">{ticket.reference}</p>
          </div>
          {ticket.checkedInAt ? (
            <p className="text-sm text-block-foreground/75">
              Checked in{" "}
              {new Date(ticket.checkedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
            </p>
          ) : null}
        </div>
      </article>

      <div className="mt-6 max-w-2xl space-y-2 text-sm leading-relaxed text-muted-foreground">
        {cancelled ? (
          <p>This place was cancelled.</p>
        ) : (
          <>
            {inPerson ? <p>Show this QR code, or the reference, at the door. A screenshot works too.</p> : null}
            <p>We will send a reminder the day before{online ? ", and the joining link again shortly before the start" : ""}.</p>
            <p>
              {ticket.paid ? (
                <>
                  Can&apos;t come? <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">Get in touch</Link> about your ticket.
                </>
              ) : (
                <>
                  Can&apos;t come? Cancel from <Link href="/account/bookings" className="font-medium text-foreground underline underline-offset-4">your bookings</Link>, so the place goes to someone waiting.
                </>
              )}
            </p>
          </>
        )}
      </div>
    </>
  );
}
