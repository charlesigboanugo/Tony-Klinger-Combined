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
  /** The level code ("silver", or one staff added). */
  cohortLevel: string;
  startsAt: string | null;
  endsAt: string | null;
  benefits: string[];
  storagePath: string | null;
  /** True when the caller holds a live entitlement to this cohort. */
  entitled: boolean;
  /** Not entitled, shown through the staff view (note 06 §23.2): no joining. */
  staffOnly: boolean;
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
export async function cohortBySlug(
  slug: string,
  { staffView = false }: { staffView?: boolean } = {},
): Promise<CohortDetail | null> {
  const supabase = await createClient();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id,name,slug,description,cohort_level,benefits,resources!cover_resource_id(storage_path)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!cohort) return null;

  const row = cohort as unknown as {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cohort_level: string;
    benefits: string[] | null;
    resources: { storage_path: string } | null;
  };

  // In the cohort = on one of its intakes, or standing access (migration
  // 0017). The dates shown are the caller's own intake's; RLS returns only
  // that intake's workshops.
  const userId = (await getAuthContext())?.userId;
  const [{ data: entitled }, { data: mine }, { data: workshops }] = await Promise.all([
    supabase.rpc("in_cohort", { p_cohort_id: row.id }),
    userId
      ? supabase
          .from("cohort_enrolments")
          .select("cohort_intakes!inner(cohort_id,starts_at,ends_at)")
          .eq("user_id", userId)
          .eq("cohort_intakes.cohort_id", row.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("cohort_workshops")
      .select("id,title,starts_at,ends_at,meeting_url,recording_resource_id,status,position,intake_id")
      .eq("cohort_id", row.id)
      .order("starts_at", { ascending: true }),
  ]);

  /*
    THE STAFF VIEW reads every intake's workshops (migration 0018), which
    listed side by side would repeat the same programme once per intake. It
    shows one intake, as a member sees theirs: the one under way, or else the
    next, or else the last to have run.
  */
  const staffOnly = staffView && entitled !== true;
  let staffIntake: { id: string; starts_at: string; ends_at: string } | undefined;
  if (staffOnly) {
    const { data: intakes } = await supabase
      .from("cohort_intakes")
      .select("id,starts_at,ends_at")
      .eq("cohort_id", row.id)
      .eq("status", "published")
      .order("starts_at");
    const list = (intakes ?? []) as Array<{ id: string; starts_at: string; ends_at: string }>;
    const nowIso = new Date().toISOString();
    staffIntake = list.find((i) => i.ends_at > nowIso) ?? list[list.length - 1];
  }
  const shown = staffOnly
    ? (workshops ?? []).filter((w) => !staffIntake || w.intake_id === staffIntake.id)
    : (workshops ?? []);

  const all = await Promise.all(
    shown.map(async (w) => {
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

  let intake: { starts_at: string; ends_at: string } | undefined = ((mine ?? []) as unknown as Array<{ cohort_intakes: { starts_at: string; ends_at: string } | null }>)
    .map((m) => m.cohort_intakes)
    .filter((i): i is { starts_at: string; ends_at: string } => i !== null)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];

  // Standing access has no intake of its own, yet the workshops listed below
  // are an intake's: the one under way, or else the next. Its dates are the
  // dates to show, not "Dates to be announced" over a schedule (owner,
  // 2026-10-09). Same rule as the cohort card (`myCohorts`).
  if (staffOnly) intake = staffIntake;
  if (!intake && entitled === true) {
    const { data: open } = await supabase
      .from("cohort_intakes")
      .select("starts_at,ends_at")
      .eq("cohort_id", row.id)
      .eq("status", "published")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(1);
    intake = (open ?? [])[0] as { starts_at: string; ends_at: string } | undefined;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    cohortLevel: row.cohort_level,
    startsAt: intake?.starts_at ?? null,
    endsAt: intake?.ends_at ?? null,
    benefits: row.benefits ?? [],
    storagePath: row.resources?.storage_path ?? null,
    entitled: entitled === true,
    staffOnly,
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
  /**
   * Held as ONE session bought for its date, not as part of a series they are
   * registered for. Said wherever sessions are listed by series, so one
   * Producing session is not read as holding the Producing series.
   */
  single: boolean;
};

/** The heading a session is listed under: its series, or "… · single session". */
export function sessionGroup(session: Pick<CoachingSession, "seriesName" | "single">): string {
  const series = session.seriesName ?? "Group Coaching";
  return session.single ? `${series} · single session` : series;
}

export type MyCoaching = {
  /** Booked, still to happen (or happening now). */
  booked: CoachingSession[];
  /** Visible and bookable, not booked. */
  available: CoachingSession[];
  /** Finished: sessions they attended, and replays of the series they hold. */
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

  const [{ data: bookings }, { data: registrations }] = await Promise.all([
    supabase
      .from("bookings")
      .select("bookable_id,status")
      .eq("user_id", userId)
      .eq("bookable_type", "group_coaching_session")
      .in("status", ["confirmed", "completed"]),
    // Registered for a run (migration 0016): a seat in every one of its
    // sessions, with nothing to book.
    supabase.from("coaching_registrations").select("run_id").eq("user_id", userId),
  ]);
  const bookedIds = new Set((bookings ?? []).map((b) => b.bookable_id));

  // Seats held through a series, as against a session bought singly.
  const seriesSeats = new Set<string>();
  const runIds = (registrations ?? []).map((r) => r.run_id);
  if (runIds.length > 0) {
    const { data: seats } = await supabase.from("group_coaching_sessions").select("id").in("run_id", runIds);
    for (const seat of seats ?? []) {
      bookedIds.add(seat.id);
      seriesSeats.add(seat.id);
    }
  }

  // Upcoming sessions the caller can see, plus every session they booked
  // whatever its date — the second list is where past replays come from —
  // plus recorded sessions that have finished. A member who holds a series is
  // owed its replays whether or not they were in the room (membership: "replays
  // of the sessions in your series"); RLS decides which of these rows, and
  // which recordings, come back at all.
  const [{ data: upcoming }, { data: mine }, { data: recorded }] = await Promise.all([
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
    supabase
      .from("group_coaching_sessions")
      .select("id,title,starts_at,ends_at,meeting_url,recording_resource_id,status,group_coaching_series(name,slug)")
      .lt("ends_at", new Date(now).toISOString())
      .not("recording_resource_id", "is", null)
      .order("starts_at", { ascending: false })
      .limit(48),
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
  for (const r of [
    ...((upcoming ?? []) as unknown as Row[]),
    ...((mine ?? []) as unknown as Row[]),
    ...((recorded ?? []) as unknown as Row[]),
  ]) {
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
      single: isBooked && !seriesSeats.has(r.id),
    };

    if (isBooked && ended) {
      past.push({ ...base, join: null, recording: await recordingFor(r.recording_resource_id) });
    } else if (ended) {
      // Not booked: listed only where the replay is theirs to watch. Someone
      // who merely holds unspent credits can see the row but not the
      // recording (0019), so it resolves to null and is left out.
      const recording = await recordingFor(r.recording_resource_id);
      if (recording) past.push({ ...base, join: null, recording });
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

// ---------------------------------------------------------------------------
// The members' live Q&A (migration 0012)
// ---------------------------------------------------------------------------

export type QaSession = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  join: JoinState;
  recording: Recording | null;
};

/**
 * The Q&A sessions a member may attend, and the recordings of past ones.
 *
 * Who sees any row at all is RLS's (`has_member_benefit('qa')`): a member
 * whose tier does not include the Q&A gets two empty lists. There is no
 * booking — every member of an included tier may join — so the link is shown
 * to all of them, inside the usual window.
 */
export async function myQaSessions(): Promise<{ upcoming: QaSession[]; past: QaSession[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_qa_sessions")
    .select("id,title,description,starts_at,ends_at,meeting_url,recording_resource_id,status")
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });

  const all = await Promise.all(
    (data ?? []).map(async (q) => {
      const join = joinState(q);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        startsAt: q.starts_at,
        endsAt: q.ends_at,
        join,
        recording: join.state === "ended" ? await recordingFor(q.recording_resource_id) : null,
      };
    }),
  );

  return {
    upcoming: all.filter((q) => q.join.state !== "ended"),
    // Newest first, and only what there is something to watch: a past Q&A
    // with no recording is not a row worth showing.
    past: all.filter((q) => q.join.state === "ended" && q.recording).reverse(),
  };
}

// ---------------------------------------------------------------------------
// Retreats (migration 0012)
// ---------------------------------------------------------------------------

export type MyRetreat = {
  id: string;
  name: string;
  slug: string;
  /** Null until the date is set. */
  startsAt: string | null;
  endsAt: string | null;
  join: JoinState | null;
  notes: string | null;
};

/**
 * Retreat batches the caller has a place on: one bought, or covered by their
 * Coaching Pass. A batch that has finished is left out — it has no replay.
 *
 * Each batch carries its own joining link (migration 0030). Batches are not
 * public: RLS lets the caller read a batch only when `has_retreat_batch_access`
 * says so, but staff can read every batch, so the access is asked of each one
 * here rather than trusting what RLS returned.
 */
export async function myRetreats(): Promise<MyRetreat[]> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: batches } = await supabase
    .from("retreat_batches")
    .select("id,label,starts_at,ends_at,join_url,joining_notes,retreats(id,name,slug,position,status)")
    .eq("status", "published")
    .gt("ends_at", nowIso)
    .order("starts_at");

  type Row = {
    id: string;
    label: string;
    starts_at: string;
    ends_at: string;
    join_url: string | null;
    joining_notes: string | null;
    retreats: { id: string; name: string; slug: string; position: number; status: string } | null;
  };

  const result: MyRetreat[] = [];
  for (const b of (batches ?? []) as unknown as Row[]) {
    if (!b.retreats || b.retreats.status !== "published") continue;
    const { data: entitled } = await supabase.rpc("has_retreat_batch_access", { p_batch_id: b.id });
    if (entitled !== true) continue;
    result.push({
      id: b.id,
      name: `${b.retreats.name} · ${b.label}`,
      slug: b.retreats.slug,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      join: joinState({
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        meeting_url: b.join_url,
        status: "scheduled",
      }),
      notes: b.joining_notes,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// A place on a series, paid for and not yet on a run (migration 0016)
// ---------------------------------------------------------------------------

export type RunChoice = {
  /** The series the place is for. */
  seriesName: string;
  /** Use-by date of the place, if it has one. */
  expiresAt: string | null;
  /** Runs open for registration now, with a place. Empty when there is none. */
  runs: Array<{ id: string; label: string; startsAt: string; endsAt: string; placesLeft: number }>;
};

/**
 * Series the caller has paid for and is not yet on a run of.
 *
 * Paying puts a buyer straight on the series' run (migration 0021: one run of
 * a series takes registrations at a time, so there is never a choice). This is
 * for the rare case left over: no run had a place at the moment they paid. The
 * place waits, and `runs` holds the one to take it on once there is one — the
 * soonest, which is the one placement itself would use.
 */
export async function myRunChoices(): Promise<RunChoice[]> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();
  const now = Date.now();

  const { data: passes } = await supabase
    .from("entitlements")
    .select("resource_id,quantity,quantity_used,expires_at")
    .eq("user_id", userId)
    .eq("resource_type", "series_pass")
    .eq("status", "active")
    .not("quantity", "is", null);

  const live = (passes ?? []).filter(
    (p) => p.resource_id && (p.quantity ?? 0) > (p.quantity_used ?? 0) && (!p.expires_at || +new Date(p.expires_at) > now),
  );
  if (live.length === 0) return [];

  const seriesIds = [...new Set(live.map((p) => p.resource_id as string))];
  const iso = new Date(now).toISOString();
  const [{ data: series }, { data: runs }] = await Promise.all([
    supabase.from("group_coaching_series").select("id,name").in("id", seriesIds),
    supabase
      .from("coaching_runs")
      .select("id,series_id,label,starts_at,ends_at")
      .in("series_id", seriesIds)
      .eq("status", "published")
      .lte("registration_opens_at", iso)
      .gt("registration_closes_at", iso)
      .order("starts_at"),
  ]);

  const withPlaces = await Promise.all(
    (runs ?? []).map(async (r) => {
      const { data: left } = await supabase.rpc("run_places_left", { p_run_id: r.id });
      return { ...r, placesLeft: typeof left === "number" ? left : 0 };
    }),
  );

  return seriesIds.map((id) => ({
    seriesName: series?.find((x) => x.id === id)?.name ?? "Group Coaching",
    expiresAt: live.filter((p) => p.resource_id === id).map((p) => p.expires_at).filter(Boolean).sort()[0] ?? null,
    runs: withPlaces
      .filter((r) => r.series_id === id && r.placesLeft > 0)
      .slice(0, 1)
      .map((r) => ({ id: r.id, label: r.label, startsAt: r.starts_at, endsAt: r.ends_at, placesLeft: r.placesLeft })),
  }));
}

// ---------------------------------------------------------------------------
// A cohort place, paid for and not yet on an intake (migration 0017)
// ---------------------------------------------------------------------------

export type IntakeChoice = {
  cohortName: string;
  /** Intakes open for registration now, with a place. Empty when there is none. */
  intakes: Array<{ id: string; label: string; startsAt: string; endsAt: string; placesLeft: number | null }>;
};

/**
 * Cohorts the caller has paid for and still has to choose an intake of.
 *
 * Paying puts a buyer straight on the intake where there is exactly one to put
 * them on. This is for the other cases: two intakes to choose between, or none
 * open with a place at the moment they paid.
 */
export async function myIntakeChoices(): Promise<IntakeChoice[]> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();
  const now = Date.now();

  const { data: places } = await supabase
    .from("entitlements")
    .select("resource_id,quantity,quantity_used,expires_at")
    .eq("user_id", userId)
    .eq("resource_type", "cohort")
    .eq("status", "active")
    .not("quantity", "is", null);

  const cohortIds = [
    ...new Set(
      (places ?? [])
        .filter((p) => p.resource_id && (p.quantity ?? 0) > (p.quantity_used ?? 0) && (!p.expires_at || +new Date(p.expires_at) > now))
        .map((p) => p.resource_id as string),
    ),
  ];
  if (cohortIds.length === 0) return [];

  const iso = new Date(now).toISOString();
  const [{ data: cohorts }, { data: intakes }] = await Promise.all([
    supabase.from("cohorts").select("id,name").in("id", cohortIds),
    supabase
      .from("cohort_intakes")
      .select("id,cohort_id,label,starts_at,ends_at,capacity")
      .in("cohort_id", cohortIds)
      .eq("status", "published")
      .lte("registration_opens_at", iso)
      .gt("starts_at", iso)
      .order("starts_at"),
  ]);

  const withPlaces = await Promise.all(
    (intakes ?? []).map(async (i) => {
      const { data: left } = i.capacity == null ? { data: null } : await supabase.rpc("intake_places_left", { p_intake_id: i.id });
      return { ...i, placesLeft: i.capacity == null ? null : typeof left === "number" ? left : 0 };
    }),
  );

  return cohortIds.map((id) => ({
    cohortName: cohorts?.find((c) => c.id === id)?.name ?? "Cohort",
    intakes: withPlaces
      .filter((i) => i.cohort_id === id && i.placesLeft !== 0)
      .map((i) => ({ id: i.id, label: i.label, startsAt: i.starts_at, endsAt: i.ends_at, placesLeft: i.placesLeft })),
  }));
}
