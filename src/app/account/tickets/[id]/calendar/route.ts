import { NextResponse } from "next/server";

import { getTicket } from "@/lib/content/tickets";
import { absoluteUrl } from "@/lib/urls";

/**
 * "Add to calendar" — an iCalendar (.ics) file for one ticket, which every
 * calendar app opens. Read under the holder's session, so it exists only for
 * someone who holds the ticket; the joining link goes in only for them.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket || !ticket.event.startsAt || ticket.status === "cancelled") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { event } = ticket;
  const start = new Date(event.startsAt!);
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  // RFC 5545 text: escape backslash, semicolon, comma and newlines.
  const text = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  const ticketUrl = absoluteUrl(`/account/tickets/${ticket.id}`);
  const where = ticket.joinUrl ?? event.venueAddress ?? event.location ?? "";
  const description = [
    `Ticket reference: ${ticket.reference}`,
    ticket.joinUrl ? `Join: ${ticket.joinUrl}` : null,
    `Your ticket: ${ticketUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tonyklinger.com//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ticket.id}@tonyklinger.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(event.name)}`,
    where ? `LOCATION:${text(where)}` : null,
    `DESCRIPTION:${text(description)}`,
    `URL:${ticketUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
