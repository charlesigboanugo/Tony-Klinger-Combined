import "server-only";

import {
  RESOURCE_LABELS,
  SOURCE_LABELS,
  myEntitlements,
  type EntitlementRow,
} from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

/**
 * The customer's access, in words — note 03 §24, note 01 §28.
 *
 * `myEntitlements()` returns rows that say "Course" and a uuid. A customer
 * needs "Screenwriting Level One — open it here". This resolves each row to
 * the thing it names and to the one action that uses it:
 *
 *   course                  -> open the course in the Academy
 *   cohort                  -> the Academy's cohort area
 *   a series (registered)   -> the Academy; from the registration, not an entitlement
 *   a single session        -> the Academy, with the date it was bought for
 *   event                   -> the ticket, which the purchase issued (migration 0018)
 *   one-to-one coaching     -> choose a time while a session is unspent; once it is
 *                              booked, the booking and its date
 *   membership              -> the member's page in the Academy (migration 0012)
 *   playlist                -> the playlist, or the library where every one is held
 *   retreat                 -> its public page, where one exists
 *
 * `resource_id` is polymorphic with no foreign key to embed through, so names
 * come from one query per type, same shape as `myCourses()`. A row whose
 * target is not readable (RLS, or deleted) keeps its generic label rather
 * than disappearing — the customer still holds it.
 *
 * WHEN ACCESS COUNTS AS ENDED. The stored status, the stored end date, and one
 * thing the database does not yet record: purchases carry no end date, so an
 * event's access would read "active" forever after the event. Here an event
 * whose date has passed is shown as ended. Display only — the row is unchanged.
 * Reading the clock belongs in the data layer, not in render.
 */
export type AccessItem = {
  id: string;
  resourceType: string;
  kind: string;
  title: string;
  source: string;
  state: "active" | "ended";
  /** Why it is not active, in words, when it is not. */
  endedReason: string | null;
  /** The date that matters for this item: an event's day, a cohort's start. */
  when: string | null;
  expiresAt: string | null;
  /** Consumable credits only. */
  credits: { used: number; total: number } | null;
  href: string | null;
  actionLabel: string | null;
  /** What `when` is, where it is not a start: "Booked for", "Took place". */
  whenLabel?: string;
  /** What `expiresAt` is, where it is not when access ends: "Use by", "Runs until". */
  endLabel?: string;
  /** One line under the title that sums the card up: "2 bought · 1 booked · 1 to book". */
  summary?: string;
};

type Named = { id: string; title: string; slug: string; starts_at?: string | null; ends_at?: string | null };

const ENDED_REASON: Record<string, string> = {
  expired: "Ended",
  consumed: "All used",
  revoked: "Withdrawn",
};

export async function myAccess(): Promise<AccessItem[]> {
  const rows = await myEntitlements();
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const idsOf = (type: string) =>
    rows
      .filter((r) => r.resource_type === type && r.resource_id)
      .map((r) => r.resource_id as string);

  const fetchNamed = async (
    type: string,
    table:
      | "courses"
      | "cohorts"
      | "group_coaching_series"
      | "events"
      | "retreats"
      | "private_coaching_services"
      | "membership_tiers"
      | "playlists",
    columns: string,
    titleColumn: "title" | "name",
  ): Promise<Map<string, Named>> => {
    const ids = idsOf(type);
    if (ids.length === 0) return new Map();
    const { data } = await supabase.from(table).select(columns).in("id", ids);
    return new Map(
      ((data ?? []) as unknown as Array<Record<string, string | null>>).map((r) => [
        r.id as string,
        {
          id: r.id as string,
          title: (r[titleColumn] as string) ?? "",
          slug: (r.slug as string) ?? "",
          starts_at: r.starts_at ?? null,
          ends_at: r.ends_at ?? null,
        },
      ]),
    );
  };

  const entitlementIds = rows.map((r) => r.id);
  const [courses, cohorts, series, events, retreats, services, tiers, playlists, tickets] = await Promise.all([
    fetchNamed("course", "courses", "id,title,slug", "title"),
    fetchNamed("cohort", "cohorts", "id,name,slug", "name"),
    // Series named by a standing series entitlement OR by sessions bought for one.
    (async () => {
      const ids = [
        ...new Set(
          rows
            .filter(
              (r) =>
                ["group_coaching_series", "group_coaching_session", "series_pass"].includes(r.resource_type) && r.resource_id,
            )
            .map((r) => r.resource_id as string),
        ),
      ];
      if (ids.length === 0) return new Map<string, Named>();
      const { data } = await supabase.from("group_coaching_series").select("id,name,slug").in("id", ids);
      return new Map((data ?? []).map((r) => [r.id, { id: r.id, title: r.name, slug: r.slug }]));
    })(),
    fetchNamed("event", "events", "id,name,slug,starts_at,ends_at", "name"),
    fetchNamed("retreat", "retreats", "id,name,slug", "name"),
    fetchNamed("private_coaching", "private_coaching_services", "id,name,slug", "name"),
    fetchNamed("membership", "membership_tiers", "id,name,slug", "name"),
    fetchNamed("playlist", "playlists", "id,name,slug", "name"),
    // The ticket a paid event place issued — linked by the entitlement that paid for it.
    supabase
      .from("bookings")
      .select("id,entitlement_id")
      .eq("bookable_type", "event")
      .in("status", ["pending", "confirmed"])
      .in("entitlement_id", entitlementIds)
      .then(({ data }) =>
        new Map(
          ((data ?? []) as Array<{ id: string; entitlement_id: string | null }>).map((b) => [
            b.entitlement_id,
            b.id,
          ]),
        ),
      ),
  ]);

  const now = Date.now();

  /*
    WHAT A SPENT SESSION BECAME (owner, 2026-10-09). A session that has been
    used is not "all used · ended <a date months away>": it is a booking with a
    date. Read here so a one-to-one session shows when it is booked for, and a
    single Group Coaching session the date it was bought for; and so nothing
    used or expired offers "Choose a time".
  */
  const { data: spentRows } = await supabase
    .from("bookings")
    .select("id,entitlement_id,starts_at,ends_at,status")
    .in("bookable_type", ["private_coaching", "group_coaching_session"])
    .in("status", ["pending", "confirmed", "completed"])
    .in("entitlement_id", entitlementIds);
  const spent = new Map<string, Array<{ starts_at: string | null; ends_at: string | null }>>();
  for (const b of (spentRows ?? []) as Array<{ entitlement_id: string | null; starts_at: string | null; ends_at: string | null }>) {
    if (!b.entitlement_id) continue;
    spent.set(b.entitlement_id, [...(spent.get(b.entitlement_id) ?? []), b]);
  }

  // A series is held by being REGISTERED for a run of it (bought, or taken
  // with a Coaching Pass), and a cohort place by being on an intake. Neither
  // is an entitlement of its own, so they are read from where they are kept.
  // The caller's own: staff can read everybody's under RLS (for Admin).
  const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
  const [{ data: registrations }, { data: enrolments }, { data: retreatPlaces }] = await Promise.all([
    supabase
      .from("coaching_registrations")
      .select("id,source,entitlement_id,coaching_runs(label,starts_at,ends_at,group_coaching_series(name))")
      .eq("user_id", userId),
    supabase
      .from("cohort_enrolments")
      .select("id,entitlement_id,cohort_intakes(label,starts_at,ends_at,cohorts(name))")
      .eq("user_id", userId),
    // A retreat place is on one batch (migration 0030).
    supabase
      .from("retreat_places")
      .select("id,entitlement_id,retreat_batches(label,starts_at,ends_at,retreats(name,slug))")
      .eq("user_id", userId),
  ]);
  type RetreatPlace = {
    id: string;
    entitlement_id: string | null;
    retreat_batches: { label: string; starts_at: string; ends_at: string; retreats: { name: string; slug: string } | null } | null;
  };
  const myRetreatPlaces = ((retreatPlaces ?? []) as unknown as RetreatPlace[]).filter((p) => p.retreat_batches);
  type Registration = {
    id: string;
    source: string;
    entitlement_id: string | null;
    coaching_runs: { label: string; starts_at: string; ends_at: string; group_coaching_series: { name: string } | null } | null;
  };
  type Enrolment = {
    id: string;
    entitlement_id: string | null;
    cohort_intakes: { label: string; starts_at: string; ends_at: string; cohorts: { name: string } | null } | null;
  };
  const myRegistrations = ((registrations ?? []) as unknown as Registration[]).filter((r) => r.coaching_runs);
  const myEnrolments = ((enrolments ?? []) as unknown as Enrolment[]).filter((e) => e.cohort_intakes);
  // The place that paid for a registration or an enrolment is shown AS that
  // registration, not a second time as a spent entitlement.
  const placed = new Set(
    [
      ...myRegistrations.map((r) => r.entitlement_id),
      ...myEnrolments.map((e) => e.entitlement_id),
      ...myRetreatPlaces.map((p) => p.entitlement_id),
    ].filter(Boolean) as string[],
  );

  const held: AccessItem[] = [
    ...myRegistrations.map((r): AccessItem => {
      const run = r.coaching_runs!;
      const over = +new Date(run.ends_at) <= now;
      return {
        id: `registration-${r.id}`,
        resourceType: "series_pass",
        kind: "Group Coaching series",
        title: `${run.group_coaching_series?.name ?? "Group Coaching"} · ${run.label}`,
        source: r.source === "membership" ? SOURCE_LABELS.membership! : r.source === "staff" ? SOURCE_LABELS.admin_grant! : SOURCE_LABELS.purchase!,
        state: over ? "ended" : "active",
        endedReason: over ? "Finished" : null,
        when: run.starts_at,
        expiresAt: run.ends_at,
        credits: null,
        href: "/academy/coaching",
        actionLabel: over ? "Watch the replays" : "Open in the Academy",
        endLabel: over ? "Finished" : "Runs until",
      };
    }),
    ...myEnrolments.map((e): AccessItem => {
      const intake = e.cohort_intakes!;
      const over = +new Date(intake.ends_at) <= now;
      return {
        id: `enrolment-${e.id}`,
        resourceType: "cohort",
        kind: RESOURCE_LABELS.cohort!,
        title: `${intake.cohorts?.name ?? "Interactive Cohort"} · ${intake.label}`,
        source: e.entitlement_id ? SOURCE_LABELS.purchase! : SOURCE_LABELS.admin_grant!,
        state: over ? "ended" : "active",
        endedReason: over ? "Finished" : null,
        when: intake.starts_at,
        expiresAt: intake.ends_at,
        credits: null,
        href: "/academy/cohorts",
        actionLabel: "Open in the Academy",
        endLabel: over ? "Finished" : "Runs until",
      };
    }),
    ...myRetreatPlaces.map((p): AccessItem => {
      const batch = p.retreat_batches!;
      const over = +new Date(batch.ends_at) <= now;
      return {
        id: `retreat-place-${p.id}`,
        resourceType: "retreat",
        kind: RESOURCE_LABELS.retreat ?? "Retreat",
        title: `${batch.retreats?.name ?? "Retreat"} · ${batch.label}`,
        source: p.entitlement_id ? SOURCE_LABELS.purchase! : SOURCE_LABELS.admin_grant!,
        state: over ? "ended" : "active",
        endedReason: over ? "Finished" : null,
        when: batch.starts_at,
        expiresAt: batch.ends_at,
        credits: null,
        href: over ? `/coaching/retreats/${batch.retreats?.slug ?? ""}` : "/academy/coaching",
        actionLabel: over ? "Retreat details" : "Open in the Academy",
        endLabel: over ? "Finished" : "Runs until",
      };
    }),
  ];

  // (A Coaching Pass also sits behind the series taken with it, and stays listed.)
  const isPlace = (row: EntitlementRow) => row.resource_type === "series_pass" || (row.resource_type === "cohort" && row.quantity != null);

  /*
    ONE CARD FOR ONE-TO-ONE COACHING (owner, 2026-10-09). Sessions are bought
    one of each per order, so two sessions were two purchases and showed as two
    cards, one "booked" and one "1 of 1 left". Everything still live for a
    service — sessions to book, and sessions booked and still to come — is one
    card that says how many of each. Sessions already taken stay as their own
    finished entries.
  */
  const isUpcoming = (b: { ends_at: string | null }) => Boolean(b.ends_at && +new Date(b.ends_at) > now);
  const liveOneToOne = (row: EntitlementRow) => {
    if (row.resource_type !== "private_coaching" || row.quantity == null) return false;
    const unexpired = !row.expires_at || +new Date(row.expires_at) > now;
    const toBook = row.status === "active" && unexpired && row.quantity - row.quantity_used > 0;
    return toBook || (spent.get(row.id) ?? []).some(isUpcoming);
  };
  const oneToOne = new Map<string, EntitlementRow[]>();
  for (const row of rows.filter(liveOneToOne)) {
    const key = row.resource_id ?? "";
    oneToOne.set(key, [...(oneToOne.get(key) ?? []), row]);
  }
  for (const [serviceId, group] of oneToOne) {
    const service = services.get(serviceId);
    const total = group.reduce((n, r) => n + (r.quantity ?? 0), 0);
    const unbooked = group.filter((r) => r.status === "active" && (r.quantity ?? 0) - r.quantity_used > 0);
    const toBook = unbooked.reduce((n, r) => n + ((r.quantity ?? 0) - r.quantity_used), 0);
    const upcoming = group
      .flatMap((r) => spent.get(r.id) ?? [])
      .filter(isUpcoming)
      .sort((a, b) => +new Date(a.starts_at ?? 0) - +new Date(b.starts_at ?? 0));
    const taken = total - toBook - upcoming.length;
    const useBy = unbooked.map((r) => r.expires_at).filter(Boolean).sort()[0] ?? null;
    held.push({
      id: `one-to-one-${serviceId}`,
      resourceType: "private_coaching",
      kind: RESOURCE_LABELS.private_coaching!,
      title: service?.title ?? RESOURCE_LABELS.private_coaching!,
      source: SOURCE_LABELS[group[0]!.source_type] ?? group[0]!.source_type,
      state: "active",
      endedReason: null,
      when: upcoming[0]?.starts_at ?? null,
      expiresAt: toBook > 0 ? useBy : null,
      // The meter is for a pack: with one session it only says "1 of 1".
      credits: total > 1 && toBook > 0 ? { used: total - toBook, total } : null,
      href: toBook > 0 && service ? `/book/private/${service.slug}` : "/account/bookings",
      actionLabel: toBook > 0 ? "Choose a time" : upcoming.length > 1 ? "View bookings" : "View booking",
      whenLabel: upcoming.length > 1 ? "Next booked for" : "Booked for",
      endLabel: "Use by",
      summary:
        total === 1
          ? toBook === 1
            ? "1 session to book"
            : "1 session, booked"
          : [
              `${total} sessions bought`,
              upcoming.length > 0 ? `${upcoming.length} booked` : null,
              taken > 0 ? `${taken} taken` : null,
              toBook > 0 ? `${toBook} to book` : null,
            ]
              .filter(Boolean)
              .join(" · "),
    });
  }

  const items = rows.filter((row) => !(isPlace(row) && placed.has(row.id)) && !liveOneToOne(row)).map((row): AccessItem => {
    const base = describe(row, { courses, cohorts, series, events, retreats, services, tiers, playlists, tickets });

    let endedReason: string | null = row.status === "active" ? null : (ENDED_REASON[row.status] ?? "Ended");
    if (!endedReason && row.expires_at && +new Date(row.expires_at) <= now) endedReason = "Ended";
    if (!endedReason && row.resource_type === "event" && base.finishesAt && +new Date(base.finishesAt) <= now) {
      endedReason = "Event has taken place";
    }

    // A session that has been spent: say what it became.
    const counted = row.resource_type === "private_coaching" || row.resource_type === "group_coaching_session";
    const bookings = counted ? (spent.get(row.id) ?? []) : [];
    const left = row.quantity != null ? row.quantity - row.quantity_used : null;
    if (counted && left !== null && left <= 0 && bookings.length > 0) {
      const single = row.resource_type === "group_coaching_session";
      const coming = bookings
        .filter((b) => b.ends_at && +new Date(b.ends_at) > now)
        .sort((a, b) => +new Date(a.starts_at ?? 0) - +new Date(b.starts_at ?? 0))[0];
      const last = [...bookings].sort((a, b) => +new Date(b.ends_at ?? 0) - +new Date(a.ends_at ?? 0))[0];
      return {
        id: row.id,
        resourceType: row.resource_type,
        kind: RESOURCE_LABELS[row.resource_type] ?? row.resource_type,
        title: single ? base.title.replace(/ sessions$/, "") : base.title,
        source: SOURCE_LABELS[row.source_type] ?? row.source_type,
        state: coming ? "active" : "ended",
        endedReason: coming ? null : "Taken place",
        when: coming?.starts_at ?? last?.starts_at ?? null,
        expiresAt: coming ? null : (last?.ends_at ?? null),
        credits: null,
        // Booked, so there is nothing left to choose a time for.
        href: coming ? (single ? "/academy/coaching" : "/account/bookings") : null,
        actionLabel: coming ? (single ? "Open in the Academy" : "View booking") : null,
        whenLabel: coming ? (single ? "Bought for" : "Booked for") : "Took place",
      };
    }

    return {
      id: row.id,
      resourceType: row.resource_type,
      kind: RESOURCE_LABELS[row.resource_type] ?? row.resource_type.replace(/_/g, " "),
      title: base.title,
      source: SOURCE_LABELS[row.source_type] ?? row.source_type,
      state: endedReason ? "ended" : "active",
      endedReason,
      when: base.when,
      expiresAt: row.expires_at,
      credits: row.quantity != null ? { used: row.quantity_used, total: row.quantity } : null,
      // An ended item keeps its ticket (a record of attendance) but loses "Book" / "Open":
      // nothing used up or past its date can be booked from here.
      href: endedReason && row.resource_type !== "event" ? null : base.href,
      actionLabel: endedReason && row.resource_type !== "event" ? null : base.actionLabel,
      // Sessions still to place have a date to use them by, not an "access until".
      ...(counted && !endedReason ? { endLabel: "Use by" } : {}),
    };
  });
  items.push(...held);

  // Active first; within each, the soonest dated item leads, undated after.
  return items.sort((a, b) => {
    if (a.state !== b.state) return a.state === "active" ? -1 : 1;
    const at = a.when ? +new Date(a.when) : Infinity;
    const bt = b.when ? +new Date(b.when) : Infinity;
    return a.state === "active" ? at - bt : bt - at;
  });
}

function describe(
  row: EntitlementRow,
  maps: {
    courses: Map<string, Named>;
    cohorts: Map<string, Named>;
    series: Map<string, Named>;
    events: Map<string, Named>;
    retreats: Map<string, Named>;
    services: Map<string, Named>;
    tiers: Map<string, Named>;
    playlists: Map<string, Named>;
    tickets: Map<string | null, string>;
  },
): { title: string; when: string | null; finishesAt: string | null; href: string | null; actionLabel: string | null } {
  const id = row.resource_id ?? "";
  const generic = RESOURCE_LABELS[row.resource_type] ?? "Access";

  switch (row.resource_type) {
    case "course": {
      const c = maps.courses.get(id);
      return {
        title: c?.title ?? generic,
        when: null,
        finishesAt: null,
        href: c ? `/academy/courses/${c.slug}` : "/academy/courses",
        actionLabel: "Open course",
      };
    }
    case "cohort": {
      // A place on one intake of the cohort (migration 0017); the intake's own
      // dates are on the Academy page.
      const c = maps.cohorts.get(id);
      return {
        title: c?.title ?? generic,
        when: null,
        finishesAt: null,
        href: "/academy/cohorts",
        actionLabel: "Open in the Academy",
      };
    }
    case "group_coaching_series": {
      const s = maps.series.get(id);
      return {
        title: s?.title ?? (row.resource_id ? generic : "Every Group Coaching series"),
        when: null,
        finishesAt: null,
        href: "/book",
        actionLabel: "Book a session",
      };
    }
    case "group_coaching_session": {
      // Sessions are for the series they were bought on (migration 0014).
      const s = maps.series.get(id);
      return {
        title: s ? `${s.title} sessions` : "Group Coaching sessions",
        when: null,
        finishesAt: null,
        // Only reached while one is unplaced: the date paid for had filled.
        href: "/book",
        actionLabel: "Choose a date",
      };
    }
    case "series_pass": {
      // A place on a run of the series (migration 0016).
      const s = maps.series.get(id);
      return {
        title: s ? `${s.title}: the series` : generic,
        when: null,
        finishesAt: null,
        href: "/academy/coaching",
        actionLabel: "Open in the Academy",
      };
    }
    case "event": {
      const e = maps.events.get(id);
      const ticket = maps.tickets.get(row.id);
      return {
        title: e?.title ?? generic,
        when: e?.starts_at ?? null,
        finishesAt: e?.ends_at ?? e?.starts_at ?? null,
        href: ticket ? `/account/tickets/${ticket}` : e ? `/events/${e.slug}` : null,
        actionLabel: ticket ? "View ticket" : e ? "Event details" : null,
      };
    }
    case "private_coaching": {
      const s = maps.services.get(id);
      const unspent = (row.quantity ?? 0) - (row.quantity_used ?? 0) > 0;
      return {
        title: s?.title ?? generic,
        when: null,
        finishesAt: null,
        href: unspent && s ? `/book/private/${s.slug}` : "/account/bookings",
        actionLabel: unspent ? "Choose a time" : "View booking",
      };
    }
    case "retreat": {
      const r = maps.retreats.get(id);
      return {
        // No id: the place a membership includes, at whichever retreat is open.
        title: r?.title ?? (row.resource_id ? generic : "A place at the Virtual Retreat"),
        // A place bought is listed as its batch, above; this is the place a
        // pass includes, which has no batch of its own.
        when: null,
        finishesAt: null,
        href: r ? `/coaching/retreats/${r.slug}` : "/coaching/retreats",
        actionLabel: "Retreat details",
      };
    }
    case "membership": {
      const t = maps.tiers.get(id);
      const name = t?.title.replace(/\s+Membership$/i, "");
      return {
        title: name ?? generic,
        when: null,
        finishesAt: null,
        href: "/academy/pass",
        actionLabel: "Open your pass",
      };
    }
    case "playlist": {
      const p = maps.playlists.get(id);
      return {
        title: p?.title ?? (row.resource_id ? generic : "Every video playlist"),
        when: null,
        finishesAt: null,
        href: p ? `/academy/playlists/${p.slug}` : "/academy/playlists",
        actionLabel: p ? "Watch" : "Open your playlists",
      };
    }
    default:
      return { title: generic, when: null, finishesAt: null, href: null, actionLabel: null };
  }
}
