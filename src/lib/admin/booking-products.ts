import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Bookings, arranged by the product they are for — note 10 §33.2.
 *
 * A booking points at one dated thing (a session, a slot, a workshop, an
 * event, a retreat). Staff think one level up: "who is on the Pitching
 * series", "who is coming to the Newcastle screening". So each booking is
 * placed under its PRODUCT, and within that under its BATCH (one run of a
 * series, one intake of a cohort, one month of one-to-one times) and its
 * ITEM (the single session or workshop).
 *
 *   kind       product              batch          item
 *   event      the event            –              –
 *   series     the series           the run        the session
 *   service    the one-to-one       the month      –
 *   cohort     the cohort           the intake     the workshop
 *   retreat    the retreat          –              –
 *
 * Callers must have passed `requirePermission("bookings.read")`: this uses
 * the service role (note 06 §2).
 */
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type BookableType = Database["public"]["Enums"]["bookable_type"];

export type ProductKind = "event" | "series" | "service" | "cohort" | "retreat";

/**
 * The kinds Bookings covers (owner, 2026-10-14): events and one-to-one
 * coaching, the two where a person holds a booked place or time. A series,
 * cohort or retreat place is followed in its own admin area (Series
 * registrations, Cohort places, Retreats), not here.
 */
export const PRODUCT_KINDS = ["event", "service"] as const satisfies readonly ProductKind[];

export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = {
  event: "Events",
  series: "Group Coaching",
  service: "One-to-one coaching",
  cohort: "Cohorts",
  retreat: "Retreats",
};

/** What a batch and an item are called for each kind; null where there is none. */
export const BATCH_NAME: Record<ProductKind, string | null> = {
  event: null,
  series: "Run",
  service: "Month",
  cohort: "Intake",
  retreat: null,
};
export const ITEM_NAME: Record<ProductKind, string | null> = {
  event: null,
  series: "Session",
  service: null,
  cohort: "Workshop",
  retreat: null,
};

export type BookingProduct = {
  kind: ProductKind;
  id: string;
  name: string;
  /** Bookings not cancelled. */
  total: number;
  /** Of those, the ones still to happen. */
  upcoming: number;
};

export type ProductBooking = {
  id: string;
  user_id: string;
  bookable_type: BookableType;
  status: BookingStatus;
  starts_at: string | null;
  reference: string | null;
  checked_in_at: string | null;
  entitlement_id: string | null;
  kind: ProductKind;
  productId: string;
  /** What was booked: the session, workshop or event by name. */
  title: string;
  batchId: string | null;
  batchLabel: string | null;
  itemId: string | null;
  itemLabel: string | null;
};

const PAGE = 1000;
const MAX_PAGES = 5;

/** Every row of a table, a thousand at a time, up to five thousand. */
export async function all<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await read(page * PAGE, page * PAGE + PAGE - 1);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })
    : "";
const month = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" }) : "No date";
const monthKey = (iso: string | null) => (iso ? iso.slice(0, 7) : "none");

/**
 * Every product that can be booked, with its bookings.
 *
 * The catalogue tables are read whole (they are small: tens to hundreds of
 * rows) and the bookings up to five thousand, so the counts beside each
 * product are true counts rather than counts of one page.
 */
export async function adminBookingDirectory(): Promise<{
  products: BookingProduct[];
  bookings: ProductBooking[];
  complete: boolean;
}> {
  const admin = createAdminClient();

  const [raw, events, series, runs, sessions, services, slots, cohorts, intakes, workshops, retreats] =
    await Promise.all([
      all<{
        id: string; user_id: string; bookable_type: BookableType; bookable_id: string; status: BookingStatus;
        starts_at: string | null; reference: string | null; checked_in_at: string | null; entitlement_id: string | null;
      }>((from, to) =>
        admin
          .from("bookings")
          .select("id,user_id,bookable_type,bookable_id,status,starts_at,reference,checked_in_at,entitlement_id")
          .order("starts_at", { ascending: false, nullsFirst: false })
          .range(from, to),
      ),
      all<{ id: string; name: string }>((f, t) => admin.from("events").select("id,name").order("starts_at", { ascending: false }).range(f, t)),
      all<{ id: string; name: string }>((f, t) => admin.from("group_coaching_series").select("id,name").order("name").range(f, t)),
      all<{ id: string; label: string }>((f, t) => admin.from("coaching_runs").select("id,label").range(f, t)),
      all<{ id: string; series_id: string; run_id: string | null; title: string; starts_at: string | null }>((f, t) =>
        admin.from("group_coaching_sessions").select("id,series_id,run_id,title,starts_at").range(f, t),
      ),
      all<{ id: string; name: string }>((f, t) => admin.from("private_coaching_services").select("id,name").order("name").range(f, t)),
      all<{ id: string; service_id: string }>((f, t) => admin.from("private_coaching_slots").select("id,service_id").range(f, t)),
      all<{ id: string; name: string }>((f, t) => admin.from("cohorts").select("id,name").order("name").range(f, t)),
      all<{ id: string; label: string }>((f, t) => admin.from("cohort_intakes").select("id,label").range(f, t)),
      all<{ id: string; cohort_id: string; intake_id: string | null; title: string; starts_at: string | null }>((f, t) =>
        admin.from("cohort_workshops").select("id,cohort_id,intake_id,title,starts_at").range(f, t),
      ),
      all<{ id: string; name: string }>((f, t) => admin.from("retreats").select("id,name").order("position").range(f, t)),
    ]);

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const [eventOf, seriesOf, runOf, sessionOf, serviceOf, slotOf, cohortOf, intakeOf, workshopOf, retreatOf] = [
    byId(events), byId(series), byId(runs), byId(sessions), byId(services), byId(slots), byId(cohorts),
    byId(intakes), byId(workshops), byId(retreats),
  ] as const;

  const bookings: ProductBooking[] = [];
  for (const b of raw) {
    const base = {
      id: b.id, user_id: b.user_id, bookable_type: b.bookable_type, status: b.status, starts_at: b.starts_at,
      reference: b.reference, checked_in_at: b.checked_in_at, entitlement_id: b.entitlement_id,
      batchId: null, batchLabel: null, itemId: null, itemLabel: null,
    };
    if (b.bookable_type === "event") {
      const event = eventOf.get(b.bookable_id);
      if (event) bookings.push({ ...base, kind: "event", productId: event.id, title: event.name });
    } else if (b.bookable_type === "group_coaching_session") {
      const session = sessionOf.get(b.bookable_id);
      if (!session || !seriesOf.has(session.series_id)) continue;
      bookings.push({
        ...base, kind: "series", productId: session.series_id, title: session.title,
        batchId: session.run_id, batchLabel: session.run_id ? (runOf.get(session.run_id)?.label ?? "Run") : null,
        itemId: session.id, itemLabel: `${session.title} · ${shortDate(session.starts_at)}`,
      });
    } else if (b.bookable_type === "private_coaching") {
      const slot = slotOf.get(b.bookable_id);
      const service = slot ? serviceOf.get(slot.service_id) : undefined;
      if (!service) continue;
      bookings.push({
        ...base, kind: "service", productId: service.id, title: service.name,
        batchId: monthKey(b.starts_at), batchLabel: month(b.starts_at),
      });
    } else if (b.bookable_type === "cohort_workshop") {
      const workshop = workshopOf.get(b.bookable_id);
      if (!workshop || !cohortOf.has(workshop.cohort_id)) continue;
      bookings.push({
        ...base, kind: "cohort", productId: workshop.cohort_id, title: workshop.title,
        batchId: workshop.intake_id, batchLabel: workshop.intake_id ? (intakeOf.get(workshop.intake_id)?.label ?? "Intake") : null,
        itemId: workshop.id, itemLabel: `${workshop.title} · ${shortDate(workshop.starts_at)}`,
      });
    } else if (b.bookable_type === "retreat") {
      const retreat = retreatOf.get(b.bookable_id);
      if (retreat) bookings.push({ ...base, kind: "retreat", productId: retreat.id, title: retreat.name });
    }
  }

  const now = Date.now();
  const tally = new Map<string, { total: number; upcoming: number }>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const key = `${b.kind}:${b.productId}`;
    const t = tally.get(key) ?? { total: 0, upcoming: 0 };
    t.total += 1;
    if (b.starts_at && new Date(b.starts_at).getTime() >= now) t.upcoming += 1;
    tally.set(key, t);
  }

  const listed = (kind: ProductKind, rows: Array<{ id: string; name: string }>): BookingProduct[] =>
    rows.map((r) => ({ kind, id: r.id, name: r.name, ...(tally.get(`${kind}:${r.id}`) ?? { total: 0, upcoming: 0 }) }));

  const shown = (kind: ProductKind) => (PRODUCT_KINDS as readonly ProductKind[]).includes(kind);
  return {
    products: [
      ...listed("event", events),
      ...listed("series", series),
      ...listed("service", services),
      ...listed("cohort", cohorts),
      ...listed("retreat", retreats),
    ].filter((p) => shown(p.kind)),
    bookings: bookings.filter((b) => shown(b.kind)),
    complete: raw.length < PAGE * MAX_PAGES,
  };
}
