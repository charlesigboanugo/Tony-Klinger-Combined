import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Booking queries — note 09 §29–§35.
 *
 * What a customer can see here is already limited by RLS: sessions are visible
 * only to those holding a covering series entitlement or unspent credits
 * (migrations 0004, 0012).
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
};

/**
 * The customer's own reservations — distinct from `bookableSessions()` above,
 * which is the SCHEDULE (what could be booked). A dashboard or account page
 * asking "what have I got coming up" wants this, not that; conflating the two
 * previously showed every session an entitlement made visible as though it
 * were already reserved (note 09 §29).
 */
export async function myBookings(): Promise<MyBooking[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id,bookable_type,bookable_id,status,starts_at,ends_at")
    .order("starts_at", { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as Array<Omit<MyBooking, "title" | "seriesName">>;

  // `bookable_id` is polymorphic — no foreign key an embed could follow — so
  // titles are resolved with a second query, same shape as `myCourses()`.
  // Group coaching is the only bookable type actually wired to the booking
  // flow today; other `bookable_type` values fall back to their generic
  // label rather than erroring.
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
