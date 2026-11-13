import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { zoom, zoomConfigured, ZoomError } from "./client";

/**
 * Zoom meetings and registrations, kept in step with events, coaching sessions
 * and the people on them — migrations 0031 and 0032, note 09 §40.2.
 *
 * Everything here RECONCILES: it compares what should exist (an upcoming event
 * or session with Zoom switched on, and the people on it) with what the site
 * has already made in Zoom, and does only the difference. So the same call is
 * safe from an admin save, a booking or cancellation, an Academy or ticket page,
 * the "Sync with Zoom now" button and the `zoom-sync` job, in any order and any
 * number of times. Whatever one of them misses (Zoom briefly down), the next
 * run catches up.
 *
 *   events, group sessions, workshops, Q&A, retreats
 *                 a meeting with registration: every person on it gets their
 *                 own link, which works on one device at a time.
 *   private       a plain meeting for the booked slot (one client, nothing to
 *                 share), its link written into the slot's `meeting_url`.
 */

export type SessionKind = "group" | "workshop" | "qa" | "retreat" | "private";

export const ZOOM_SESSION_TABLES: Record<SessionKind, string> = {
  group: "group_coaching_sessions",
  workshop: "cohort_workshops",
  qa: "member_qa_sessions",
  retreat: "retreat_batches",
  private: "private_coaching_slots",
};

export function sessionKindOfTable(table: string): SessionKind | null {
  const found = Object.entries(ZOOM_SESSION_TABLES).find(([, t]) => t === table);
  return found ? (found[0] as SessionKind) : null;
}

/** What one event or session asks of Zoom. */
type Target = {
  label: string;
  key: { event_id: string } | { session_kind: SessionKind; session_id: string };
  /** Should a meeting exist now? */
  wanted: boolean;
  topic: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Personal links (registration), or one plain link (private coaching). */
  registration: boolean;
};

type MeetingRow = {
  id: string;
  meeting_id: string | null;
  signature: string | null;
  join_url: string | null;
};
type LiveMeeting = MeetingRow & { meeting_id: string };

export type ZoomSyncSummary = {
  meetingsCreated: number;
  meetingsUpdated: number;
  meetingsDeleted: number;
  registered: number;
  unregistered: number;
  errors: string[];
};

const emptySummary = (): ZoomSyncSummary => ({
  meetingsCreated: 0,
  meetingsUpdated: 0,
  meetingsDeleted: 0,
  registered: 0,
  unregistered: 0,
  errors: [],
});

const MEETING_COLUMNS = "id,meeting_id,signature,join_url";
// An event with no end time is treated as two hours long.
const DEFAULT_MINUTES = 120;
// A retreat batch can run for days; Zoom takes one meeting's length in minutes
// and keeps the link working regardless, so a day is the most sent.
const MAX_MINUTES = 24 * 60;
// People are registered for a session from this far ahead: the link only shows
// from 15 minutes before the start, and a pass holder's Q&A runs all year.
const REGISTER_AHEAD_DAYS = 14;
// Bumped when the settings sent to Zoom change, so every meeting is updated once.
const SETTINGS_VERSION = 1;

function endOf(target: Pick<Target, "startsAt" | "endsAt">): number | null {
  if (!target.startsAt) return null;
  return target.endsAt ? Date.parse(target.endsAt) : Date.parse(target.startsAt) + DEFAULT_MINUTES * 60_000;
}

function finished(target: Pick<Target, "startsAt" | "endsAt">): boolean {
  const end = endOf(target);
  return end !== null && end <= Date.now();
}

function meetingBody(target: Target) {
  const start = new Date(target.startsAt!);
  const minutes = Math.round(((endOf(target) ?? 0) - start.getTime()) / 60_000) || DEFAULT_MINUTES;
  return {
    topic: target.topic.slice(0, 200),
    type: 2,
    start_time: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    duration: Math.min(MAX_MINUTES, Math.max(15, minutes)),
    timezone: "Europe/London",
    settings: target.registration
      ? {
          // Registration on, approved automatically: the booking is the approval.
          approval_type: 0,
          registration_type: 1,
          // One device per link: a forwarded link cannot be in the room twice.
          allow_multiple_devices: false,
          // The site sends the link; Zoom sends nothing of its own.
          registrants_email_notification: false,
          registrants_confirmation_email: false,
          // Nobody needs a Zoom account of their own.
          meeting_authentication: false,
        }
      : {
          // One client: a plain link, with the waiting room so nobody else
          // walks in on the session.
          approval_type: 2,
          waiting_room: true,
          meeting_authentication: false,
        },
  };
}

function signatureOf(target: Target): string {
  const { topic, start_time, duration } = meetingBody(target);
  return JSON.stringify({ v: SETTINGS_VERSION, topic, start_time, duration, registration: target.registration });
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : "unknown error";
}

function ignoreNotFound(caught: unknown) {
  // Already gone from Zoom (deleted there by hand): nothing left to do.
  if (!(caught instanceof ZoomError && caught.notFound)) throw caught;
}

async function deleteMeeting(meetingId: string) {
  await zoom("DELETE", `/meetings/${meetingId}?schedule_for_reminder=false&cancel_meeting_reminder=false`).catch(ignoreNotFound);
}

function rowQuery(key: Target["key"]) {
  const query = createAdminClient().from("zoom_meetings").select(MEETING_COLUMNS);
  return "event_id" in key
    ? query.eq("event_id", key.event_id)
    : query.eq("session_kind", key.session_kind).eq("session_id", key.session_id);
}

async function recordError(rowId: string | undefined, text: string) {
  if (!rowId) return;
  await createAdminClient()
    .from("zoom_meetings")
    .update({ last_error: text.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", rowId);
}

/**
 * Make, update or remove the meeting one event or session asks for. Returns it
 * when it should exist, or null. `onRemoved` runs after a meeting is deleted
 * (private coaching clears the slot's link).
 */
async function ensureMeeting(
  target: Target,
  summary: ZoomSyncSummary,
  onRemoved?: (row: MeetingRow) => Promise<void>,
): Promise<LiveMeeting | null> {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await rowQuery(target.key).maybeSingle<MeetingRow>();
  if (readError) throw new Error(`zoom_meetings: ${readError.message}`);
  let row = existing;

  if (!target.wanted) {
    // A finished one keeps its meeting: Zoom holds its history and reports.
    // Otherwise (Zoom switched off, unpublished, cancelled, moved to in person,
    // unbooked) the meeting goes, and every personal link with it.
    if (row && !finished(target)) {
      if (row.meeting_id) await deleteMeeting(row.meeting_id);
      await admin.from("zoom_meetings").delete().eq("id", row.id);
      await onRemoved?.(row);
      summary.meetingsDeleted += 1;
    }
    return null;
  }

  if (!row) {
    // The row first, then the meeting: a crash between the two leaves a row
    // with no meeting, which the next run completes, never a meeting the site
    // has lost track of.
    const { data: inserted, error } = await admin
      .from("zoom_meetings")
      .upsert({ ...target.key }, { onConflict: "event_id" in target.key ? "event_id" : "session_kind,session_id" })
      .select(MEETING_COLUMNS)
      .single<MeetingRow>();
    if (error) throw new Error(`zoom_meetings: ${error.message}`);
    row = inserted;
  }

  try {
    const signature = signatureOf(target);
    if (row.meeting_id && row.signature !== signature) {
      try {
        await zoom("PATCH", `/meetings/${row.meeting_id}`, meetingBody(target));
        summary.meetingsUpdated += 1;
      } catch (caught) {
        ignoreNotFound(caught);
        // Deleted in Zoom by hand: make it again. The old links died with it.
        await admin.from("zoom_registrants").delete().eq("meeting_row_id", row.id);
        await admin.from("zoom_session_registrants").delete().eq("meeting_row_id", row.id);
        row.meeting_id = null;
      }
    }

    if (!row.meeting_id) {
      const created = await zoom<{ id: number; join_url: string }>("POST", "/users/me/meetings", meetingBody(target));
      row.meeting_id = String(created.id);
      row.join_url = target.registration ? null : created.join_url;
      summary.meetingsCreated += 1;
    }

    const { data: kept } = await admin
      .from("zoom_meetings")
      .update({
        meeting_id: row.meeting_id,
        join_url: row.join_url,
        signature,
        ends_at: new Date(endOf(target)!).toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("id");
    // Zoom was switched off (and this row removed) while the meeting was being
    // made: the meeting has no record left to find it by, so it goes now.
    if (!kept?.length) {
      await deleteMeeting(row.meeting_id);
      return null;
    }
  } catch (caught) {
    await recordError(row.id, message(caught));
    throw caught;
  }

  return row as LiveMeeting;
}

/** First and last name for Zoom's registration form, from the profile. */
async function registrantFor(userId: string) {
  const admin = createAdminClient();
  const [{ data: user }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("first_name,last_name,display_name").eq("user_id", userId).maybeSingle(),
  ]);
  const email = user.user?.email;
  if (!email) return null;

  // Zoom's form needs a first AND a last name; they show in the participant
  // list, where staff match them against their own list. A one-word display
  // name or an email has no last name, so "-" stands in.
  const [first, ...rest] = (
    [profile?.first_name, profile?.last_name].filter((part) => part?.trim()).join(" ") ||
    profile?.display_name?.trim() ||
    email.split("@")[0]
  ).split(/\s+/);
  return { email, first_name: first.slice(0, 64), last_name: (rest.join(" ") || "-").slice(0, 64) };
}

async function register(meetingId: string, userId: string) {
  const person = await registrantFor(userId);
  if (!person) return null;
  // Registering an email already on the meeting returns the same registration,
  // so a repeat after a lost write is harmless.
  return zoom<{ registrant_id: string; join_url: string }>("POST", `/meetings/${meetingId}/registrants`, person);
}

/**
 * Register everyone who should have a link and has none; remove everyone who
 * has one and should not. One person Zoom refuses never holds up the others:
 * Zoom allows only three registration attempts per person, per meeting, per
 * day, so a refusal is retried by later runs but can then wait until midnight
 * GMT. Throws at the end if anyone was refused, so it shows as the error.
 */
async function reconcilePeople<Key extends string>(
  meetingId: string,
  should: Map<Key, string>,
  have: Map<Key, string>,
  add: (key: Key, registrant: { registrant_id: string; join_url: string }) => Promise<void>,
  drop: (key: Key) => Promise<void>,
  summary: ZoomSyncSummary,
) {
  const refused: string[] = [];

  for (const [key, registrantId] of have) {
    if (should.has(key)) continue;
    try {
      await zoom("DELETE", `/meetings/${meetingId}/registrants/${registrantId}`).catch(ignoreNotFound);
      await drop(key);
      summary.unregistered += 1;
    } catch (caught) {
      refused.push(message(caught));
    }
  }

  for (const [key, userId] of should) {
    if (have.has(key)) continue;
    try {
      const added = await register(meetingId, userId);
      if (!added) continue;
      await add(key, added);
      summary.registered += 1;
    } catch (caught) {
      refused.push(message(caught));
    }
  }

  if (refused.length) {
    throw new Error(`${refused.length} ${refused.length === 1 ? "person" : "people"} not registered yet. ${refused[0]}`);
  }
}

async function run(label: string, summary: ZoomSyncSummary, work: () => Promise<void>) {
  try {
    await work();
  } catch (caught) {
    const text = message(caught);
    summary.errors.push(`${label}: ${text}`);
    console.error("zoom sync failed", { label, message: text });
  }
}

// ---------------------------------------------------------------------------
// Events (0031): one link per ticket
// ---------------------------------------------------------------------------

/** Bring one event's meeting and ticket links into line. Never throws. */
export async function syncZoomEvent(eventId: string, summary: ZoomSyncSummary = emptySummary()): Promise<ZoomSyncSummary> {
  if (!zoomConfigured()) return summary;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id,name,starts_at,ends_at,format,status,uses_zoom")
    .eq("id", eventId)
    .maybeSingle();

  await run(event?.name ?? eventId, summary, async () => {
    const target: Target = {
      label: event?.name ?? eventId,
      key: { event_id: eventId },
      wanted: false,
      topic: event?.name ?? "",
      startsAt: event?.starts_at ?? null,
      endsAt: event?.ends_at ?? null,
      registration: true,
    };
    target.wanted = Boolean(event?.uses_zoom && event.status === "published" && event.format !== "in_person" && event.starts_at && !finished(target));

    const meeting = await ensureMeeting(target, summary);
    if (!meeting) return;

    try {
      const [{ data: bookings, error: bookingsError }, { data: registrants, error: registrantsError }] = await Promise.all([
        admin.from("bookings").select("id,user_id,status").eq("bookable_type", "event").eq("bookable_id", eventId),
        admin.from("zoom_registrants").select("booking_id,registrant_id").eq("meeting_row_id", meeting.id),
      ]);
      if (bookingsError) throw new Error(`bookings: ${bookingsError.message}`);
      if (registrantsError) throw new Error(`zoom_registrants: ${registrantsError.message}`);

      await reconcilePeople(
        meeting.meeting_id,
        new Map(
          (bookings ?? [])
            .filter((b) => ["pending", "confirmed", "completed"].includes(b.status))
            .map((b) => [b.id as string, b.user_id as string]),
        ),
        new Map((registrants ?? []).map((r) => [r.booking_id as string, r.registrant_id as string])),
        async (bookingId, added) => {
          const { error } = await admin.from("zoom_registrants").upsert({
            booking_id: bookingId,
            meeting_row_id: meeting.id,
            registrant_id: added.registrant_id,
            join_url: added.join_url,
          });
          if (error) throw new Error(`zoom_registrants: ${error.message}`);
        },
        async (bookingId) => {
          await admin.from("zoom_registrants").delete().eq("booking_id", bookingId);
        },
        summary,
      );
    } catch (caught) {
      await recordError(meeting.id, message(caught));
      throw caught;
    }
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Coaching sessions (0032): one link per person; private coaching a plain one
// ---------------------------------------------------------------------------

async function sessionTarget(kind: SessionKind, id: string): Promise<{ target: Target; slotUrl?: string | null }> {
  const admin = createAdminClient();
  const key = { session_kind: kind, session_id: id };
  const absent = (): { target: Target } => ({
    target: { label: `${kind} ${id}`, key, wanted: false, topic: "", startsAt: null, endsAt: null, registration: kind !== "private" },
  });

  switch (kind) {
    case "group":
    case "workshop":
    case "qa": {
      const { data } = await admin
        .from(ZOOM_SESSION_TABLES[kind])
        .select("title,starts_at,ends_at,status,uses_zoom")
        .eq("id", id)
        .maybeSingle();
      if (!data) return absent();
      const target: Target = { label: data.title, key, wanted: false, topic: data.title, startsAt: data.starts_at, endsAt: data.ends_at, registration: true };
      target.wanted = data.uses_zoom && data.status === "scheduled" && !finished(target);
      return { target };
    }
    case "retreat": {
      const { data } = await admin
        .from("retreat_batches")
        .select("label,starts_at,ends_at,status,uses_zoom,retreats(name,status)")
        .eq("id", id)
        .maybeSingle();
      if (!data) return absent();
      const retreat = data.retreats as unknown as { name: string; status: string } | null;
      const topic = `${retreat?.name ?? "Retreat"} · ${data.label}`;
      const target: Target = { label: topic, key, wanted: false, topic, startsAt: data.starts_at, endsAt: data.ends_at, registration: true };
      target.wanted = data.uses_zoom && data.status === "published" && retreat?.status === "published" && !finished(target);
      return { target };
    }
    case "private": {
      const [{ data: slot }, { count }] = await Promise.all([
        admin
          .from("private_coaching_slots")
          .select("starts_at,ends_at,status,uses_zoom,meeting_url,private_coaching_services(name)")
          .eq("id", id)
          .maybeSingle(),
        admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("bookable_type", "private_coaching")
          .eq("bookable_id", id)
          .eq("status", "confirmed"),
      ]);
      if (!slot) return absent();
      const service = slot.private_coaching_services as unknown as { name: string } | null;
      const topic = `${service?.name ?? "Private coaching"} with Tony Klinger`;
      const target: Target = { label: topic, key, wanted: false, topic, startsAt: slot.starts_at, endsAt: slot.ends_at, registration: false };
      // A meeting only once the time is booked: open times are not meetings.
      target.wanted = slot.uses_zoom && slot.status === "open" && (count ?? 0) > 0 && !finished(target);
      return { target, slotUrl: slot.meeting_url };
    }
  }
}

/** Bring one session's meeting and links into line. Never throws. */
export async function syncZoomSession(
  kind: SessionKind,
  id: string,
  summary: ZoomSyncSummary = emptySummary(),
): Promise<ZoomSyncSummary> {
  if (!zoomConfigured()) return summary;
  const admin = createAdminClient();
  const { target, slotUrl } = await sessionTarget(kind, id);

  await run(target.label, summary, async () => {
    const meeting = await ensureMeeting(target, summary, async (removed) => {
      // The slot's link was the meeting's: clear it, but never a link staff
      // typed in themselves.
      if (kind === "private" && removed.join_url && slotUrl === removed.join_url) {
        await admin.from("private_coaching_slots").update({ meeting_url: null }).eq("id", id);
      }
    });
    if (!meeting) return;

    if (kind === "private") {
      if (meeting.join_url && slotUrl !== meeting.join_url) {
        const { error } = await admin.from("private_coaching_slots").update({ meeting_url: meeting.join_url }).eq("id", id);
        if (error) throw new Error(`private_coaching_slots: ${error.message}`);
      }
      return;
    }

    try {
      const soon = Date.parse(target.startsAt!) - Date.now() < REGISTER_AHEAD_DAYS * 86_400_000;
      const [{ data: people, error: peopleError }, { data: registrants, error: registrantsError }] = await Promise.all([
        soon
          ? admin.rpc("session_attendance").eq("kind", kind).eq("item_id", id)
          : Promise.resolve({ data: [], error: null }),
        admin.from("zoom_session_registrants").select("user_id,registrant_id").eq("meeting_row_id", meeting.id),
      ]);
      if (peopleError) throw new Error(`session_attendance: ${peopleError.message}`);
      if (registrantsError) throw new Error(`zoom_session_registrants: ${registrantsError.message}`);

      const have = new Map((registrants ?? []).map((r) => [r.user_id as string, r.registrant_id as string]));
      // Not yet in the registering window: nobody is added, and nobody already
      // registered is removed for that reason alone.
      const should = soon
        ? new Map(((people ?? []) as Array<{ user_id: string }>).map((p) => [p.user_id, p.user_id]))
        : have;

      await reconcilePeople(
        meeting.meeting_id,
        should,
        have,
        async (userId, added) => {
          const { error } = await admin.from("zoom_session_registrants").upsert({
            meeting_row_id: meeting.id,
            user_id: userId,
            registrant_id: added.registrant_id,
            join_url: added.join_url,
          });
          if (error) throw new Error(`zoom_session_registrants: ${error.message}`);
        },
        async (userId) => {
          await admin.from("zoom_session_registrants").delete().eq("meeting_row_id", meeting.id).eq("user_id", userId);
        },
        summary,
      );
    } catch (caught) {
      await recordError(meeting.id, message(caught));
      throw caught;
    }
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** The event or session a booking belongs to, synced: for one just made or cancelled. */
export async function syncZoomForBooking(bookingId: string): Promise<void> {
  if (!zoomConfigured()) return;
  const { data } = await createAdminClient().from("bookings").select("bookable_type,bookable_id").eq("id", bookingId).maybeSingle();
  if (!data) return;
  if (data.bookable_type === "event") await syncZoomEvent(data.bookable_id);
  else if (data.bookable_type === "group_coaching_session") await syncZoomSession("group", data.bookable_id);
  else if (data.bookable_type === "private_coaching") await syncZoomSession("private", data.bookable_id);
}

/**
 * The `zoom-sync` job: every upcoming event and session on Zoom, every meeting
 * whose event or session changed or went, and meetings left behind by a
 * deleted event or session.
 */
export async function syncZoom(): Promise<ZoomSyncSummary | { skipped: string }> {
  if (!zoomConfigured()) return { skipped: "Zoom is not configured" };
  const admin = createAdminClient();
  const summary = emptySummary();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const { data: meetings, error: meetingsError } = await admin
    .from("zoom_meetings")
    .select("id,event_id,session_kind,session_id,meeting_id,ends_at")
    .or(`ends_at.is.null,ends_at.gte.${since}`);
  if (meetingsError) throw new Error(`zoom_meetings: ${meetingsError.message}`);

  // Events: Zoom on and not long over, plus every meeting row still for one.
  const { data: events, error: eventsError } = await admin.from("events").select("id").eq("uses_zoom", true).gte("starts_at", since);
  if (eventsError) throw new Error(`events: ${eventsError.message}`);
  const eventIds = new Set<string>((events ?? []).map((e) => e.id));
  for (const m of meetings ?? []) if (m.event_id) eventIds.add(m.event_id);
  for (const id of eventIds) await syncZoomEvent(id, summary);

  // Sessions, kind by kind, the same way.
  for (const kind of Object.keys(ZOOM_SESSION_TABLES) as SessionKind[]) {
    const { data: rows, error } = await admin.from(ZOOM_SESSION_TABLES[kind]).select("id").eq("uses_zoom", true).gte("ends_at", since);
    if (error) throw new Error(`${ZOOM_SESSION_TABLES[kind]}: ${error.message}`);
    const ids = new Set<string>((rows ?? []).map((r) => r.id));
    for (const m of meetings ?? []) if (m.session_kind === kind && m.session_id) ids.add(m.session_id);
    // A deleted session leaves its meeting row; `sessionTarget` finds nothing
    // there, so the meeting is removed like any other unwanted one.
    for (const id of ids) await syncZoomSession(kind, id, summary);
  }

  // The event was deleted: its meeting goes too.
  for (const orphan of (meetings ?? []).filter((m) => !m.event_id && !m.session_kind)) {
    await run(`meeting ${orphan.meeting_id}`, summary, async () => {
      if (orphan.meeting_id) await deleteMeeting(orphan.meeting_id);
      await admin.from("zoom_meetings").delete().eq("id", orphan.id);
      summary.meetingsDeleted += 1;
    });
  }

  return summary;
}
