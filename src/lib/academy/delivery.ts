import "server-only";

import { BUCKETS, isPublicBucket, type Bucket } from "@/lib/storage";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/permissions";

/**
 * Live delivery in the Academy: cohort workshops and Group Coaching sessions,
 * their joining links and their recordings — note 07 §23, §35, §36.
 *
 * WHO SEES WHAT is decided by RLS, not here:
 *
 *   cohort workshop     a live entitlement to its cohort (0002)
 *   coaching session    series access, unspent credits, or a booking of it (0003, 0019)
 *   recording           access to the workshop or session it records (0019)
 *
 * What this file adds on top is WHEN. A meeting link is shown only inside a
 * window around the session, and a coaching link only to someone who actually
 * booked — credits make a session visible, not joinable.
 */

/** How early the joining link appears — long enough to test audio. */
export const JOIN_OPENS_MINUTES = 15;

export type JoinState =
  | { state: "open"; url: string }
  /** Scheduled with a link, not yet in the window. `today`: opens within the
   *  next 12 hours, so a bare time is unambiguous. */
  | { state: "soon"; opensAt: string; today: boolean }
  /** Scheduled, but nobody has added the link yet. */
  | { state: "pending" }
  | { state: "ended" }
  | { state: "cancelled" };

/**
 * Reading the clock is impure, so it happens here with the data rather than
 * during render — the same reason `myBookingsByTime()` partitions server-side.
 */
function joinState(row: {
  starts_at: string;
  ends_at: string;
  meeting_url: string | null;
  status: string;
}): JoinState {
  if (row.status === "cancelled") return { state: "cancelled" };

  const now = Date.now();
  const opens = +new Date(row.starts_at) - JOIN_OPENS_MINUTES * 60_000;
  if (now > +new Date(row.ends_at) || row.status === "completed") return { state: "ended" };
  if (!row.meeting_url) return { state: "pending" };
  if (now < opens) {
    return { state: "soon", opensAt: new Date(opens).toISOString(), today: opens - now < 12 * 3_600_000 };
  }
  return { state: "open", url: row.meeting_url };
}

export type Recording = { url: string; external: boolean };

/**
 * The playable address of a recording, or null.
 *
 * The resource row is read AS THE USER, so RLS (0019) is the access decision:
 * a caller who may not open the parent gets no row. A row in a private bucket
 * carries only a path, and the object is then signed with the service role —
 * safe because the row coming back at all was the check. Short-lived on
 * purpose: long enough to press play, not worth forwarding.
 */
async function recordingFor(resourceId: string | null): Promise<Recording | null> {
  if (!resourceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select("storage_path,external_url")
    .eq("id", resourceId)
    .maybeSingle();
  if (!data) return null;

  if (data.external_url) return { url: data.external_url, external: true };
  if (!data.storage_path) return null;

  const key = data.storage_path.replace(/^\/+/, "");
  const [bucket, ...rest] = key.split("/");
  const known = Object.values(BUCKETS) as string[];
  if (!known.includes(bucket) || rest.length === 0) return null;

  if (isPublicBucket(bucket as Bucket)) {
    const url = publicStorageUrl(key);
    return url ? { url, external: false } : null;
  }

  const { data: signed } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(rest.join("/"), 60 * 60);
  return signed?.signedUrl ? { url: signed.signedUrl, external: false } : null;
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export type Workshop = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  join: JoinState;
  recording: Recording | null;
};

export type CohortDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cohortLevel: "silver" | "gold" | "platinum";
  startsAt: string | null;
  endsAt: string | null;
  benefits: string[];
  storagePath: string | null;
  /** True when the caller holds a live entitlement to this cohort. */
  entitled: boolean;
  upcoming: Workshop[];
  past: Workshop[];
};

/**
 * One cohort, with its workshop schedule when the caller holds a place.
 *
 * The cohort itself is public marketing data and always resolves; workshops
 * come back only with a live entitlement, which is what lets the page tell
 * "locked" apart from "missing" — the same shape as `courseWithContent()`.
 */
export async function cohortBySlug(slug: string): Promise<CohortDetail | null> {
  const supabase = await createClient();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select(
      "id,name,slug,description,cohort_level,starts_at,ends_at,benefits,resources!cover_resource_id(storage_path)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!cohort) return null;

  const row = cohort as unknown as {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cohort_level: "silver" | "gold" | "platinum";
    starts_at: string | null;
    ends_at: string | null;
    benefits: string[] | null;
    resources: { storage_path: string } | null;
  };

  const [{ data: entitled }, { data: workshops }] = await Promise.all([
    supabase.rpc("has_active_entitlement", {
      p_resource_type: "cohort",
      p_resource_id: row.id,
    }),
    supabase
      .from("cohort_workshops")
      .select("id,title,starts_at,ends_at,meeting_url,recording_resource_id,status,position")
      .eq("cohort_id", row.id)
      .order("starts_at", { ascending: true }),
  ]);

  const all = await Promise.all(
    (workshops ?? []).map(async (w) => {
      const join = joinState(w);
      return {
        id: w.id,
        title: w.title,
        startsAt: w.starts_at,
        endsAt: w.ends_at,
        join,
        recording: join.state === "ended" ? await recordingFor(w.recording_resource_id) : null,
      };
    }),
  );

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    cohortLevel: row.cohort_level,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    benefits: row.benefits ?? [],
    storagePath: row.resources?.storage_path ?? null,
    entitled: entitled === true,
    upcoming: all.filter((w) => w.join.state !== "ended" && w.join.state !== "cancelled"),
    past: all.filter((w) => w.join.state === "ended").reverse(),
  };
}

/** The next live workshops across every cohort the caller holds — for the dashboard. */
export async function nextWorkshops(limit = 3) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohort_workshops")
    .select("id,title,starts_at,ends_at,status,meeting_url,cohorts(name,slug)")
    .neq("status", "cancelled")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  return ((data ?? []) as unknown as Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    status: string;
    meeting_url: string | null;
    cohorts: { name: string; slug: string } | null;
  }>).map((w) => ({
    id: w.id,
    title: w.title,
    startsAt: w.starts_at,
    endsAt: w.ends_at,
    join: joinState(w),
    cohortName: w.cohorts?.name ?? null,
    cohortSlug: w.cohorts?.slug ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Group Coaching
// ---------------------------------------------------------------------------

export type CoachingSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  seriesName: string | null;
  seriesSlug: string | null;
  /** Only for a session the caller has booked. */
  join: JoinState | null;
  recording: Recording | null;
};

export type MyCoaching = {
  /** Booked, still to happen (or happening now). */
  booked: CoachingSession[];
  /** Visible and bookable, not booked. */
  available: CoachingSession[];
  /** Booked and finished — where replays live. */
  past: CoachingSession[];
};

/**
 * The coaching page's three lists, from one read of the schedule and one of
 * the caller's own bookings. Visibility is RLS's; this only sorts what came
 * back by whether it was booked and whether it has happened.
 */
export async function myCoaching(): Promise<MyCoaching> {
  const supabase = await createClient();
  const now = Date.now();

  // The caller's own bookings: staff can read everyone's under RLS.
  const userId = (await getAuthContext())?.userId;
  if (!userId) return { booked: [], available: [], past: [] };

  const { data: bookings } = await supabase
    .from("bookings")
    .select("bookable_id,status")
    .eq("user_id", userId)
    .eq("bookable_type", "group_coaching_session")
    .in("status", ["confirmed", "completed"]);
  const bookedIds = new Set((bookings ?? []).map((b) => b.bookable_id));

  // Upcoming sessions the caller can see, plus every session they booked
  // whatever its date — the second list is where past replays come from.
  const [{ data: upcoming }, { data: mine }] = await Promise.all([
    supabase
      .from("group_coaching_sessions")
      .select("id,title,starts_at,ends_at,meeting_url,recording_resource_id,status,group_coaching_series(name,slug)")
      .eq("status", "scheduled")
      .gte("ends_at", new Date(now).toISOString())
      .order("starts_at", { ascending: true })
      .limit(24),
    bookedIds.size > 0
      ? supabase
          .from("group_coaching_sessions")
          .select("id,title,starts_at,ends_at,meeting_url,recording_resource_id,status,group_coaching_series(name,slug)")
          .in("id", [...bookedIds])
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  type Row = {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    meeting_url: string | null;
    recording_resource_id: string | null;
    status: string;
    group_coaching_series: { name: string; slug: string } | null;
  };

  const byId = new Map<string, Row>();
  for (const r of [...((upcoming ?? []) as unknown as Row[]), ...((mine ?? []) as unknown as Row[])]) {
    byId.set(r.id, r);
  }

  const booked: CoachingSession[] = [];
  const available: CoachingSession[] = [];
  const past: CoachingSession[] = [];

  for (const r of byId.values()) {
    if (r.status === "cancelled") continue;
    const isBooked = bookedIds.has(r.id);
    const ended = +new Date(r.ends_at) < now || r.status === "completed";
    const base = {
      id: r.id,
      title: r.title,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      seriesName: r.group_coaching_series?.name ?? null,
      seriesSlug: r.group_coaching_series?.slug ?? null,
    };

    if (isBooked && ended) {
      past.push({ ...base, join: null, recording: await recordingFor(r.recording_resource_id) });
    } else if (isBooked) {
      booked.push({ ...base, join: joinState(r), recording: null });
    } else if (!ended) {
      available.push({ ...base, join: null, recording: null });
    }
  }

  const byStart = (a: CoachingSession, b: CoachingSession) => +new Date(a.startsAt) - +new Date(b.startsAt);
  booked.sort(byStart);
  available.sort(byStart);
  past.sort((a, b) => byStart(b, a));

  return { booked, available, past };
}

// ---------------------------------------------------------------------------
// Private coaching (migration 0020)
// ---------------------------------------------------------------------------

export type PrivateSession = {
  id: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  join: JoinState | null;
};

export type PrivateCredit = {
  serviceName: string;
  serviceSlug: string;
  remaining: number;
};

export type MyPrivateCoaching = {
  /** Confirmed, still to happen (or happening now). Past ones live in Account → Bookings. */
  booked: PrivateSession[];
  /** Paid (or returned) sessions not yet given a time. */
  credits: PrivateCredit[];
};

/**
 * The caller's private sessions and unspent private sessions. The slot row —
 * and with it the call link — is readable only through the caller's own
 * confirmed booking (`pc_slots: booked read`), so a hold or a cancelled
 * booking yields nothing to join.
 */
export async function myPrivateCoaching(): Promise<MyPrivateCoaching> {
  const supabase = await createClient();
  const now = Date.now();

  // Filtered to the caller explicitly: staff also hold "read all" policies on
  // bookings and entitlements, and their own Academy must not list everyone's.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { booked: [], credits: [] };

  const [{ data: bookings }, { data: entitlements }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,bookable_id,status,starts_at,ends_at")
      .eq("user_id", user.id)
      .eq("bookable_type", "private_coaching")
      .eq("status", "confirmed")
      .gte("ends_at", new Date(now).toISOString()),
    supabase
      .from("entitlements")
      .select("resource_id,quantity,quantity_used,expires_at")
      .eq("user_id", user.id)
      .eq("resource_type", "private_coaching")
      .eq("status", "active")
      .not("quantity", "is", null),
  ]);

  const slotIds = (bookings ?? []).map((b) => b.bookable_id);
  const { data: slots } = slotIds.length
    ? await supabase
        .from("private_coaching_slots")
        .select("id,meeting_url,status,private_coaching_services(name)")
        .in("id", slotIds)
    : { data: [] };

  type Slot = {
    id: string;
    meeting_url: string | null;
    status: string;
    private_coaching_services: { name: string } | null;
  };
  const slotById = new Map(((slots ?? []) as unknown as Slot[]).map((s) => [s.id, s]));

  const booked: PrivateSession[] = [];
  for (const b of bookings ?? []) {
    if (!b.starts_at || !b.ends_at) continue;
    const slot = slotById.get(b.bookable_id);
    booked.push({
      id: b.id,
      serviceName: slot?.private_coaching_services?.name ?? "Private coaching",
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      join: joinState({
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        meeting_url: slot?.meeting_url ?? null,
        status: "scheduled",
      }),
    });
  }
  booked.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  // Unspent sessions, summed per service.
  const remainingByService = new Map<string, number>();
  for (const e of entitlements ?? []) {
    if (!e.resource_id || e.quantity == null) continue;
    if (e.expires_at && +new Date(e.expires_at) <= now) continue;
    const left = e.quantity - (e.quantity_used ?? 0);
    if (left > 0) remainingByService.set(e.resource_id, (remainingByService.get(e.resource_id) ?? 0) + left);
  }

  let credits: PrivateCredit[] = [];
  if (remainingByService.size > 0) {
    const { data: services } = await supabase
      .from("private_coaching_services")
      .select("id,name,slug")
      .in("id", [...remainingByService.keys()]);
    credits = (services ?? []).map((s) => ({
      serviceName: s.name,
      serviceSlug: s.slug,
      remaining: remainingByService.get(s.id) ?? 0,
    }));
  }

  return { booked, credits };
}
