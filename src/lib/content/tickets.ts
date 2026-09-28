import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/permissions";

import type { EventFormat } from "./events";

/**
 * One event ticket, as its holder sees it (migration 0018).
 *
 * Read under the holder's own session: bookings RLS returns only their own
 * rows, and `event_access` (the private joining link) is readable only by
 * someone holding a live place on that event. Anybody else gets null.
 */
export type Ticket = {
  id: string;
  reference: string;
  status: string;
  paid: boolean;
  checkedInAt: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
    startsAt: string | null;
    endsAt: string | null;
    location: string | null;
    venueAddress: string | null;
    format: EventFormat;
  };
  joinUrl: string | null;
  joiningNotes: string | null;
};

export async function getTicket(bookingId: string): Promise<Ticket | null> {
  // The caller's own ticket only: staff can read every booking, and a ticket
  // page is not where they look at someone else's (that is Admin → Check-in).
  const userId = (await getAuthContext())?.userId;
  if (!userId) return null;

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id,reference,status,entitlement_id,checked_in_at,bookable_id,bookable_type")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .eq("bookable_type", "event")
    .maybeSingle();
  if (!booking?.reference) return null;

  const [{ data: event }, { data: access }] = await Promise.all([
    supabase
      .from("events")
      .select("id,name,slug,starts_at,ends_at,location,venue_address,format")
      .eq("id", booking.bookable_id)
      .maybeSingle(),
    supabase.from("event_access").select("join_url,joining_notes").eq("event_id", booking.bookable_id).maybeSingle(),
  ]);
  if (!event) return null;

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    paid: Boolean(booking.entitlement_id),
    checkedInAt: booking.checked_in_at,
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      venueAddress: event.venue_address,
      format: event.format,
    },
    // Only a web address becomes a link: a staff typo or a `javascript:` value
    // must never render as something a ticket holder can click.
    joinUrl: booking.status === "cancelled" ? null : safeUrl(access?.join_url),
    joiningNotes: booking.status === "cancelled" ? null : (access?.joining_notes ?? null),
  };
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
