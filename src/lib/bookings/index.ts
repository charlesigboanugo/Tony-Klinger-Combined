import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/permissions";

/**
 * Booking queries — note 09 §29–§35.
 *
 * What a customer can see here is already limited by RLS: sessions are visible
 * only to those holding a covering series entitlement or unspent credits
 * (migrations 0002_security_and_reference_data, 0003_commerce_and_bookings).
 */
export type BookableSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  seriesName: string | null;
};

export async function bookableSessions(): Promise<BookableSession[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_coaching_sessions")
    .select("id,title,starts_at,ends_at,capacity,group_coaching_series(name)")
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return ((data ?? []) as unknown as Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    group_coaching_series: { name: string } | null;
  }>).map((s) => ({
    id: s.id,
    title: s.title,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    capacity: s.capacity,
    seriesName: s.group_coaching_series?.name ?? null,
  }));
}

export async function getBookableSession(id: string) {
  const sessions = await bookableSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export type MyBooking = {
  id: string;
  bookable_type: string;
  bookable_id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  /** Human-readable label, where resolved — null falls back to `bookable_type`. */
  title: string | null;
  seriesName: string | null;
  /** Event tickets only (migration 0018): the code shown at the door. */
  reference: string | null;
  /** Set when a purchase paid for this place — a paid ticket. */
  entitlement_id: string | null;
};

/**
 * The customer's own reservations — distinct from `bookableSessions()` above,
 * which is the SCHEDULE (what could be booked). A dashboard or account page
 * asking "what have I got coming up" wants this, not that; conflating the two
 * previously showed every session an entitlement made visible as though it
 * were already reserved (note 09 §29).
 */
export async function myBookings(): Promise<MyBooking[]> {
  // The caller's own: staff can read every booking under RLS (for Admin).
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id,bookable_type,bookable_id,status,starts_at,ends_at,reference,entitlement_id")
    .eq("user_id", userId)
    .order("starts_at", { ascending: true, nullsFirst: false });

  // A private coaching booking with no entitlement behind it is a HOLD that
  // was never paid for (migration 0020) — the checkout was abandoned. It was
  // never the customer's booking, so it is not listed as one.
  const rows = ((data ?? []) as Array<Omit<MyBooking, "title" | "seriesName">>).filter(
    (r) => !(r.bookable_type === "private_coaching" && !r.entitlement_id),
  );

  // `bookable_id` is polymorphic — no foreign key an embed could follow — so
  // titles are resolved with a second query, same shape as `myCourses()`.
  // Group coaching sessions and free events (migration 0017) are the bookable
  // types wired to a booking flow today; other `bookable_type` values fall
  // back to their generic label rather than erroring.
  const sessionIds = rows
    .filter((r) => r.bookable_type === "group_coaching_session")
    .map((r) => r.bookable_id);

  const bySessionId = new Map<string, { title: string; seriesName: string | null }>();
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("group_coaching_sessions")
      .select("id,title,group_coaching_series(name)")
      .in("id", sessionIds);

    for (const s of (sessions ?? []) as unknown as Array<{
      id: string;
      title: string;
      group_coaching_series: { name: string } | null;
    }>) {
      bySessionId.set(s.id, { title: s.title, seriesName: s.group_coaching_series?.name ?? null });
    }
  }

  const eventIds = rows.filter((r) => r.bookable_type === "event").map((r) => r.bookable_id);
  if (eventIds.length > 0) {
    const { data: events } = await supabase.from("events").select("id,name").in("id", eventIds);
    for (const e of events ?? []) bySessionId.set(e.id, { title: e.name, seriesName: "Event" });
  }

  // Private coaching: the slot is readable through the caller's own
  // confirmed booking; a cancelled one keeps the generic label.
  const slotIds = rows.filter((r) => r.bookable_type === "private_coaching").map((r) => r.bookable_id);
  if (slotIds.length > 0) {
    const { data: slots } = await supabase
      .from("private_coaching_slots")
      .select("id,private_coaching_services(name)")
      .in("id", slotIds);
    for (const s of (slots ?? []) as unknown as Array<{
      id: string;
      private_coaching_services: { name: string } | null;
    }>) {
      bySessionId.set(s.id, {
        title: s.private_coaching_services?.name ?? "Private coaching",
        seriesName: "Private coaching",
      });
    }
  }

  return rows.map((r) => ({
    ...r,
    title: bySessionId.get(r.bookable_id)?.title ?? null,
    seriesName: bySessionId.get(r.bookable_id)?.seriesName ?? null,
  }));
}

/**
 * Split bookings into upcoming and everything else.
 *
 * Partitioned here rather than in the page: reading the clock during render
 * makes a component impure, since the same render could produce different
 * output. Data access is already impure, so the time boundary belongs with it.
 */
export async function myBookingsByTime(): Promise<{
  upcoming: MyBooking[];
  rest: MyBooking[];
}> {
  const bookings = await myBookings();
  const now = Date.now();

  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.starts_at && +new Date(b.starts_at) > now,
  );
  const upcomingIds = new Set(upcoming.map((b) => b.id));

  return { upcoming, rest: bookings.filter((b) => !upcomingIds.has(b.id)) };
}
