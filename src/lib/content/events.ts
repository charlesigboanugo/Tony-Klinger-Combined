import "server-only";

import { coverPath, type ProductPrice } from "@/lib/content/coaching";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type EventImage = { path: string; caption: string | null };

export type EventFormat = "in_person" | "online" | "hybrid";

export const FORMAT_LABEL: Record<EventFormat, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "In person and online",
};

export type PublicEvent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  capacity: number | null;
  is_free: boolean;
  format: EventFormat;
  /** Full street address for in-person and hybrid events (migration 0018). */
  venue_address: string | null;
  /** Public-bucket cover (migration 0017), or null. */
  storagePath: string | null;
};

export type EventDetail = PublicEvent & {
  /** Photographs from the event, in order; empty when there are none. */
  gallery: EventImage[];
  /** Places already taken, counted server-side without exposing bookings. */
  taken: number;
  /** The product a paid ticket is bought as, when one is on sale. */
  ticket: { productSlug: string; price: ProductPrice } | null;
};

/** What the person looking at an event already has for it. */
export type EventViewer = {
  signedIn: boolean;
  /** Their live ticket, if they hold one. */
  booking: { id: string; reference: string | null } | null;
  /** Their place in the waiting list, if they are on it. */
  waitlistPosition: number | null;
};

type Row = Omit<PublicEvent, "storagePath"> & { resources?: unknown; products?: unknown };

const FIELDS =
  "id,name,slug,description,starts_at,ends_at,location,capacity,is_free,format,venue_address,resources!events_cover_resource_id_fkey(storage_path)";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toEvent({ resources, products, ...row }: Row): PublicEvent {
  return { ...row, storagePath: coverPath(resources as Parameters<typeof coverPath>[0]) };
}

/** Published events — note 03 §8.1, note 08 §35. */
export async function listEvents(): Promise<PublicEvent[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("events")
    .select(FIELDS)
    .eq("status", "published")
    .order("starts_at", { ascending: true, nullsFirst: false });

  return ((data as Row[] | null) ?? []).map(toEvent);
}

export async function getEvent(slug: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(`${FIELDS},products(slug,status,prices(amount,currency,billing_type,interval,active))`)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;

  const row = data as Row;
  const event = toEvent(row);
  const [images, taken] = await Promise.all([
    supabase
      .from("event_images")
      .select("caption,position,resources!event_images_resource_id_fkey(storage_path)")
      .eq("event_id", event.id)
      .order("position"),
    supabase.rpc("event_places_taken", { p_event_id: event.id }),
  ]);

  const gallery = (images.data ?? []).flatMap((row) => {
    const path = coverPath(row.resources as Parameters<typeof coverPath>[0]);
    return path ? [{ path, caption: row.caption }] : [];
  });

  return {
    ...event,
    gallery,
    taken: typeof taken.data === "number" ? taken.data : 0,
    ticket: event.is_free ? null : ticketFor(row.products),
  };
}

type ProductEmbed = { slug: string; status: string; prices: (ProductPrice & { active: boolean })[] };

/** An active product with an active one-off price, or nothing on sale. */
function ticketFor(embed: unknown): EventDetail["ticket"] {
  const product = (Array.isArray(embed) ? embed[0] : embed) as ProductEmbed | null | undefined;
  if (!product || product.status !== "active") return null;
  const price = product.prices?.find((p) => p.active && p.billing_type !== "recurring");
  return price ? { productSlug: product.slug, price } : null;
}

/** The signed-in visitor's ticket and waitlist place for one event. */
export async function eventViewer(eventId: string): Promise<EventViewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, booking: null, waitlistPosition: null };

  const [booking, position] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,reference")
      .eq("user_id", user.id)
      .eq("bookable_type", "event")
      .eq("bookable_id", eventId)
      .in("status", ["pending", "confirmed"])
      .maybeSingle(),
    supabase.rpc("my_waitlist_position", { p_event_id: eventId }),
  ]);

  return {
    signedIn: true,
    booking: booking.data ?? null,
    waitlistPosition: typeof position.data === "number" ? position.data : null,
  };
}

/**
 * Split events into upcoming and past. Upcoming runs soonest first; past runs
 * most recent first, because the last event is the one people look for.
 *
 * Done here rather than in the page because reading the clock during render
 * makes a component impure — the same render could produce different output.
 * Data fetching is already impure by nature, so the time boundary belongs
 * alongside it.
 */
export async function listEventsByTime(): Promise<{
  upcoming: PublicEvent[];
  past: PublicEvent[];
}> {
  const events = await listEvents();
  const now = Date.now();

  return {
    upcoming: events.filter((e) => !e.starts_at || +new Date(e.starts_at) >= now),
    past: events.filter((e) => e.starts_at && +new Date(e.starts_at) < now).reverse(),
  };
}

/** Whether an event has already started, read at request time on the server. */
export function hasStarted(event: Pick<PublicEvent, "starts_at">): boolean {
  return Boolean(event.starts_at && +new Date(event.starts_at) <= Date.now());
}

/*
  Every event time is shown in UK time, whatever the server's zone. Tony's
  events are UK-based, and a server in another region would otherwise print
  a different hour from the one on the ticket.
*/
const ZONE = "Europe/London";

export function formatEventDate(starts?: string | null, ends?: string | null) {
  if (!starts) return "Date to be announced";
  return `${eventDay(starts)}, ${eventTime(starts, ends)}`;
}

/** "Thursday 12 March 2026". */
export function eventDay(starts: string) {
  return new Date(starts).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONE,
  });
}

/** "19:00–21:00" (or just the start). */
export function eventTime(starts: string, ends?: string | null) {
  const t = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });
  return ends ? `${t(starts)}–${t(ends)}` : t(starts);
}

/** The parts of a date for a calendar-leaf badge: "12", "Mar", "2026". */
export function eventLeaf(starts: string) {
  const d = new Date(starts);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: ZONE });
  return { day: part({ day: "numeric" }), month: part({ month: "short" }), year: part({ year: "numeric" }) };
}

/** Whether an event falls on today's date in the UK — for the door's verdict. */
export function isTodayInUk(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: ZONE });
  return day(new Date(iso)) === day(new Date());
}

/**
 * Events for the staff check-in list: anything from two days ago onwards,
 * drafts included (staff can see them under `events.read`), soonest first.
 */
export async function listCheckInEvents() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("events")
    .select("id,name,starts_at,format,location,capacity,status")
    .gte("starts_at", since)
    .order("starts_at");
  return data ?? [];
}

/** "Sat 5 Dec 2026" — the compact form, for the facts row. */
export function eventDayShort(starts: string) {
  return new Date(starts)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: ZONE })
    .replace(",", "");
}
