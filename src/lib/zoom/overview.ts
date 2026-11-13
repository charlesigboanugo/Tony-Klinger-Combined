import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { ZOOM_SESSION_TABLES, type SessionKind } from "./sync";

/**
 * Admin → Zoom: every event and session run on Zoom, with its meeting, how
 * many people have their own link, the last error, and any clash — Tony's
 * Zoom account hosts one meeting at a time (note 09 §40.2).
 *
 * Read with the service role after the page has checked its permission: the
 * list spans five areas whose staff permissions differ.
 */

export type ZoomKind = "event" | SessionKind;

export const ZOOM_KIND_LABEL: Record<ZoomKind, string> = {
  event: "Event",
  group: "Group Coaching",
  workshop: "Cohort workshop",
  qa: "Q&A",
  retreat: "Retreat",
  private: "Private coaching",
};

const EDIT_PATH: Record<ZoomKind, string> = {
  event: "/admin/events",
  group: "/admin/sessions",
  workshop: "/admin/workshops",
  qa: "/admin/qa-sessions",
  retreat: "/admin/retreat-batches",
  private: "/admin/coaching-slots",
};

export type ZoomRow = {
  key: string;
  kind: ZoomKind;
  title: string;
  startsAt: string;
  endsAt: string;
  href: string;
  meetingId: string | null;
  /** People with their own link; null for private coaching (one plain link). */
  links: number | null;
  error: string | null;
  /** Titles of other Zoom items overlapping this one. */
  clashes: string[];
};

type Source = { id: string; title: string; starts_at: string; ends_at: string | null };

async function sources(kind: ZoomKind, past: boolean): Promise<Source[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const order = { ascending: !past };

  switch (kind) {
    case "event": {
      const query = admin.from("events").select("id,name,starts_at,ends_at").eq("uses_zoom", true).not("starts_at", "is", null);
      const { data } = await (past ? query.lt("starts_at", now) : query.gte("starts_at", new Date(Date.now() - 86_400_000).toISOString()))
        .order("starts_at", order)
        .limit(200);
      // An event with no end runs two hours, as in the sync.
      return (data ?? [])
        .map((e) => ({
          id: e.id,
          title: e.name,
          starts_at: e.starts_at!,
          ends_at: e.ends_at ?? new Date(+new Date(e.starts_at!) + 2 * 3_600_000).toISOString(),
        }))
        .filter((e) => (past ? e.ends_at < now : e.ends_at >= now));
    }
    case "retreat": {
      const query = admin.from("retreat_batches").select("id,label,starts_at,ends_at,retreats(name)").eq("uses_zoom", true);
      const { data } = await (past ? query.lt("ends_at", now) : query.gte("ends_at", now)).order("starts_at", order).limit(200);
      return (data ?? []).map((b) => ({
        id: b.id,
        title: `${(b.retreats as unknown as { name: string } | null)?.name ?? "Retreat"} · ${b.label}`,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
      }));
    }
    case "private": {
      const query = admin.from("private_coaching_slots").select("id,starts_at,ends_at,private_coaching_services(name)").eq("uses_zoom", true);
      const { data } = await (past ? query.lt("ends_at", now) : query.gte("ends_at", now)).order("starts_at", order).limit(200);
      return (data ?? []).map((s) => ({
        id: s.id,
        title: (s.private_coaching_services as unknown as { name: string } | null)?.name ?? "Private coaching",
        starts_at: s.starts_at,
        ends_at: s.ends_at,
      }));
    }
    default: {
      const query = admin.from(ZOOM_SESSION_TABLES[kind]).select("id,title,starts_at,ends_at").eq("uses_zoom", true).neq("status", "cancelled");
      const { data } = await (past ? query.lt("ends_at", now) : query.gte("ends_at", now)).order("starts_at", order).limit(200);
      return (data ?? []) as Source[];
    }
  }
}

export async function zoomOverview(past: boolean): Promise<ZoomRow[]> {
  const admin = createAdminClient();
  const kinds = Object.keys(ZOOM_KIND_LABEL) as ZoomKind[];
  const lists = await Promise.all(kinds.map((kind) => sources(kind, past)));

  const { data: meetings } = await admin.from("zoom_meetings").select("id,event_id,session_kind,session_id,meeting_id,last_error");
  const meetingFor = new Map<string, { id: string; meeting_id: string | null; last_error: string | null }>();
  for (const m of meetings ?? []) {
    if (m.event_id) meetingFor.set(`event:${m.event_id}`, m);
    else if (m.session_kind && m.session_id) meetingFor.set(`${m.session_kind}:${m.session_id}`, m);
  }

  const [{ data: ticketLinks }, { data: sessionLinks }] = await Promise.all([
    admin.from("zoom_registrants").select("meeting_row_id"),
    admin.from("zoom_session_registrants").select("meeting_row_id"),
  ]);
  const linkCount = new Map<string, number>();
  for (const r of [...(ticketLinks ?? []), ...(sessionLinks ?? [])]) {
    linkCount.set(r.meeting_row_id, (linkCount.get(r.meeting_row_id) ?? 0) + 1);
  }

  const rows: ZoomRow[] = kinds.flatMap((kind, i) =>
    lists[i].map((s) => {
      const key = `${kind}:${s.id}`;
      const meeting = meetingFor.get(key);
      return {
        key,
        kind,
        title: s.title,
        startsAt: s.starts_at,
        endsAt: s.ends_at ?? s.starts_at,
        href: `${EDIT_PATH[kind]}/${s.id}`,
        meetingId: meeting?.meeting_id ?? null,
        links: kind === "private" ? null : meeting ? (linkCount.get(meeting.id) ?? 0) : 0,
        error: meeting?.last_error ?? null,
        clashes: [],
      };
    }),
  );

  // Two Zoom meetings at once cannot both be hosted from one account. A
  // private time counts only once booked (it has a meeting): open times
  // overlapping each other are normal.
  const hosted = rows.filter((r) => r.kind !== "private" || r.meetingId);
  for (const a of hosted) {
    for (const b of hosted) {
      if (a !== b && a.startsAt < b.endsAt && b.startsAt < a.endsAt) a.clashes.push(b.title);
    }
  }

  return rows.sort((a, b) => (past ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
}

/**
 * How many people hold their own link for each listed item on Zoom, for the
 * list's switch: turning Zoom off says how many links it will stop (owner,
 * 2026-11-13). Private coaching has one plain link, so it counts none.
 */
export async function zoomLinkCounts(table: string, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0 || table === "private_coaching_slots") return counts;
  const admin = createAdminClient();
  const kind = (Object.entries(ZOOM_SESSION_TABLES).find(([, t]) => t === table)?.[0] ?? null) as SessionKind | null;
  if (table !== "events" && !kind) return counts;

  const { data: meetings } =
    table === "events"
      ? await admin.from("zoom_meetings").select("id,event_id").in("event_id", ids)
      : await admin.from("zoom_meetings").select("id,session_id").eq("session_kind", kind!).in("session_id", ids);
  const itemOf = new Map((meetings ?? []).map((m) => [m.id as string, String("event_id" in m ? m.event_id : m.session_id)]));
  if (itemOf.size === 0) return counts;

  const { data: links } = await admin
    .from(table === "events" ? "zoom_registrants" : "zoom_session_registrants")
    .select("meeting_row_id")
    .in("meeting_row_id", [...itemOf.keys()]);
  for (const l of links ?? []) {
    const item = itemOf.get(l.meeting_row_id as string);
    if (item) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

/** Zoom cannot be switched off from a list this close to the start. */
export const ZOOM_OFF_CUTOFF_HOURS = 2;

/** The listed items on Zoom that start within the cut-off, and so cannot be switched off from a list. */
export function tooCloseToTurnOff(rows: Array<Record<string, unknown>>, now = Date.now()): Set<string> {
  return new Set(
    rows
      .filter((r) => r.uses_zoom === true && typeof r.starts_at === "string" && Date.parse(r.starts_at) - now < ZOOM_OFF_CUTOFF_HOURS * 3_600_000)
      .map((r) => String(r.id)),
  );
}
