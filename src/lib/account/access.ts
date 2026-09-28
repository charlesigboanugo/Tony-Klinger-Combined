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
 *   group coaching series   -> book a session (access is per series, booking per session)
 *   session credits         -> book a session, with how many are left
 *   event                   -> the ticket, which the purchase issued (migration 0018)
 *   private coaching        -> choose a time while a session is unspent (migration 0020)
 *   retreat, masterclass    -> their public page, where one exists
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
      | "masterclasses"
      | "private_coaching_services",
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
  const [courses, cohorts, series, events, retreats, masterclasses, services, tickets] = await Promise.all([
    fetchNamed("course", "courses", "id,title,slug", "title"),
    fetchNamed("cohort", "cohorts", "id,name,slug,starts_at,ends_at", "name"),
    fetchNamed("group_coaching_series", "group_coaching_series", "id,name,slug", "name"),
    fetchNamed("event", "events", "id,name,slug,starts_at,ends_at", "name"),
    fetchNamed("retreat", "retreats", "id,name,slug,starts_at,ends_at", "name"),
    fetchNamed("masterclass", "masterclasses", "id,title,slug,starts_at,ends_at", "title"),
    fetchNamed("private_coaching", "private_coaching_services", "id,name,slug", "name"),
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

  const items = rows.map((row): AccessItem => {
    const base = describe(row, { courses, cohorts, series, events, retreats, masterclasses, services, tickets });

    let endedReason: string | null = row.status === "active" ? null : (ENDED_REASON[row.status] ?? "Ended");
    if (!endedReason && row.expires_at && +new Date(row.expires_at) <= now) endedReason = "Ended";
    if (!endedReason && row.resource_type === "event" && base.finishesAt && +new Date(base.finishesAt) <= now) {
      endedReason = "Event has taken place";
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
      // An ended item keeps its ticket (a record of attendance) but loses "Book" / "Open".
      href: endedReason && row.resource_type !== "event" ? null : base.href,
      actionLabel: endedReason && row.resource_type !== "event" ? null : base.actionLabel,
    };
  });

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
    masterclasses: Map<string, Named>;
    services: Map<string, Named>;
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
      const c = maps.cohorts.get(id);
      return {
        title: c?.title ?? generic,
        when: c?.starts_at ?? null,
        finishesAt: c?.ends_at ?? null,
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
        href: "/bookings",
        actionLabel: "Book a session",
      };
    }
    case "group_coaching_session":
      return {
        title: "Group Coaching session credits",
        when: null,
        finishesAt: null,
        href: "/bookings",
        actionLabel: "Book a session",
      };
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
        href: unspent && s ? `/bookings/private/${s.slug}` : "/account/bookings",
        actionLabel: unspent ? "Choose a time" : "View booking",
      };
    }
    case "retreat": {
      const r = maps.retreats.get(id);
      return {
        title: r?.title ?? generic,
        when: r?.starts_at ?? null,
        finishesAt: r?.ends_at ?? null,
        href: "/coaching/retreats",
        actionLabel: "Retreat details",
      };
    }
    case "masterclass": {
      const m = maps.masterclasses.get(id);
      return { title: m?.title ?? generic, when: m?.starts_at ?? null, finishesAt: m?.ends_at ?? null, href: null, actionLabel: null };
    }
    default:
      return { title: generic, when: null, finishesAt: null, href: null, actionLabel: null };
  }
}
