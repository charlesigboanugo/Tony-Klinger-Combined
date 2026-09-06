import "server-only";

import { createClient } from "@/lib/supabase/server";

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
};

const FIELDS =
  "id,name,slug,description,starts_at,ends_at,location,capacity,is_free";

/** Published events — note 03 §8.1, note 08 §35. */
export async function listEvents(): Promise<PublicEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(FIELDS)
    .eq("status", "published")
    .order("starts_at", { ascending: true, nullsFirst: false });

  return (data as PublicEvent[] | null) ?? [];
}

export async function getEvent(slug: string): Promise<PublicEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(FIELDS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  return (data as PublicEvent | null) ?? null;
}

/**
 * Split events into upcoming and past.
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
    past: events.filter((e) => e.starts_at && +new Date(e.starts_at) < now),
  };
}

export function formatEventDate(starts?: string | null, ends?: string | null) {
  if (!starts) return "Date to be announced";
  const start = new Date(starts);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  };
  const date = start.toLocaleDateString("en-GB", opts);
  const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (!ends) return `${date}, ${time}`;
  const endTime = new Date(ends).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}–${endTime}`;
}
