import "server-only";

import { all } from "@/lib/admin/booking-products";
import { codeLabel } from "@/lib/admin/labels";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entitlements, arranged by what the access is for — note 10 §33.2.
 *
 * An entitlement names a kind of thing (`resource_type`) and, usually, one of
 * them (`resource_id`). Staff ask "who has the Gold pass", "who can watch
 * this course", so each is placed under that product. One with no id covers
 * everything of its kind, and is listed as such.
 *
 * WHICH TABLE AN ID POINTS AT is fixed per kind, and two are not what the
 * name suggests: a `group_coaching_session` credit and a `series_pass` both
 * name the SERIES they are for, not a session or a run.
 *
 * Callers must have passed `requirePermission("entitlements.read")`: this
 * uses the service role (note 06 §2).
 */
const SOURCES: Record<string, { table: string; label: string }> = {
  course: { table: "courses", label: "title" },
  membership: { table: "membership_tiers", label: "name" },
  cohort: { table: "cohorts", label: "name" },
  event: { table: "events", label: "name" },
  retreat: { table: "retreats", label: "name" },
  playlist: { table: "playlists", label: "name" },
  private_coaching: { table: "private_coaching_services", label: "name" },
  group_coaching_session: { table: "group_coaching_series", label: "name" },
  group_coaching_series: { table: "group_coaching_series", label: "name" },
  series_pass: { table: "group_coaching_series", label: "name" },
};

/**
 * The kinds listed even when nobody holds them, one per catalogue table
 * (owner, 2026-10-14: everything should appear "whether it has zero stuff on
 * it so I can see it exists"). A series is listed once, under the kind it is
 * bought as; access to a series through a pass still appears under its own
 * kind once someone holds it.
 */
const ALWAYS_LISTED = [
  "course",
  "membership",
  "cohort",
  "event",
  "retreat",
  "playlist",
  "private_coaching",
  "group_coaching_session",
] as const;

/** The id used in the URL for access that covers everything of its kind. */
export const WHOLE_KIND = "any";

/** Kinds whose own word says little; the rest go through `codeLabel`. */
const KIND_LABEL: Record<string, string> = {
  membership: "Coaching Passes",
  course: "Courses",
  cohort: "Cohorts",
  event: "Events",
  retreat: "Retreats",
  playlist: "Playlists",
  private_coaching: "One-to-one coaching",
  group_coaching_session: "Group Coaching sessions",
  group_coaching_series: "Group Coaching series",
  series_pass: "Series taken on a pass",
};
export const kindLabel = (type: string) => KIND_LABEL[type] ?? codeLabel(type);

export type AccessRow = {
  id: string;
  user_id: string;
  resource_type: string;
  resource_id: string | null;
  source_type: string;
  status: string;
  quantity: number | null;
  quantity_used: number;
  expires_at: string | null;
  grant_reason: string | null;
  created_at: string;
};

export type AccessProduct = {
  type: string;
  /** The resource's id, or `WHOLE_KIND`. */
  id: string;
  name: string;
  /** Entitlements that are active now. */
  active: number;
  total: number;
};

export async function adminEntitlementDirectory(): Promise<{
  products: AccessProduct[];
  entitlements: AccessRow[];
  complete: boolean;
}> {
  const admin = createAdminClient();

  const entitlements = await all<AccessRow>((from, to) =>
    admin
      .from("entitlements")
      .select("id,user_id,resource_type,resource_id,source_type,status,quantity,quantity_used,expires_at,grant_reason,created_at")
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  // One read per catalogue table that anything points at, or that is always
  // listed.
  const tables = [
    ...new Set(
      [...entitlements.map((e) => SOURCES[e.resource_type]), ...ALWAYS_LISTED.map((k) => SOURCES[k])]
        .filter(Boolean)
        .map((s) => `${s.table}:${s.label}`),
    ),
  ];
  const names = new Map<string, Map<string, string>>();
  await Promise.all(
    tables.map(async (key) => {
      const [table, label] = key.split(":");
      const rows = await all<Record<string, string>>((from, to) =>
        // The table name comes from the fixed map above, never from a request.
        admin.from(table as "courses").select(`id,${label}`).range(from, to),
      );
      names.set(table, new Map(rows.map((r) => [r.id, r[label]])));
    }),
  );

  const products = new Map<string, AccessProduct>();
  for (const e of entitlements) {
    const id = e.resource_id ?? WHOLE_KIND;
    const key = `${e.resource_type}:${id}`;
    let product = products.get(key);
    if (!product) {
      const source = SOURCES[e.resource_type];
      const name = e.resource_id
        ? ((source ? names.get(source.table)?.get(e.resource_id) : undefined) ?? "No longer exists")
        : `All ${kindLabel(e.resource_type).toLowerCase()}`;
      product = { type: e.resource_type, id, name, active: 0, total: 0 };
      products.set(key, product);
    }
    product.total += 1;
    if (e.status === "active") product.active += 1;
  }

  // Everything in the catalogue, held or not, so nothing is invisible here.
  for (const kind of ALWAYS_LISTED) {
    const source = SOURCES[kind];
    for (const [id, name] of names.get(source.table) ?? []) {
      const key = `${kind}:${id}`;
      if (!products.has(key)) products.set(key, { type: kind, id, name, active: 0, total: 0 });
    }
  }

  return {
    products: [...products.values()].sort(
      (a, b) => kindLabel(a.type).localeCompare(kindLabel(b.type)) || a.name.localeCompare(b.name),
    ),
    entitlements,
    complete: entitlements.length < 5000,
  };
}

/**
 * What each of one person's entitlements is for, by name: "Gold Coaching
 * Pass", not "Membership" (owner, 2026-10-15). Keyed by entitlement id. Only
 * the catalogue rows those entitlements name are read.
 */
export async function accessNames(
  rows: Array<{ id: string; resource_type: string; resource_id: string | null }>,
): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const wanted = new Map<string, { label: string; ids: Set<string> }>();
  for (const e of rows) {
    const source = SOURCES[e.resource_type];
    if (!source || !e.resource_id) continue;
    const entry = wanted.get(source.table) ?? { label: source.label, ids: new Set<string>() };
    entry.ids.add(e.resource_id);
    wanted.set(source.table, entry);
  }
  const found = new Map<string, string>();
  await Promise.all(
    [...wanted].map(async ([table, { label, ids }]) => {
      // The table name comes from the fixed map above, never from a request.
      const { data } = await admin.from(table as "courses").select(`id,${label}`).in("id", [...ids]);
      for (const r of (data ?? []) as unknown as Array<Record<string, string>>) found.set(`${table}:${r.id}`, r[label]);
    }),
  );
  return new Map(
    rows.map((e) => {
      const source = SOURCES[e.resource_type];
      const name = e.resource_id
        ? ((source ? found.get(`${source.table}:${e.resource_id}`) : undefined) ?? "No longer exists")
        : `All ${kindLabel(e.resource_type).toLowerCase()}`;
      return [e.id, name];
    }),
  );
}

/** Kinds that are held as a number of sessions rather than as access. */
export const COUNTED_KINDS = ["private_coaching", "group_coaching_session"] as const;

/**
 * The kinds offered when granting by hand, in the order shown. A series taken
 * on a pass (`series_pass`) is not granted directly: it follows from the pass.
 */
const GRANTABLE: Array<{ kind: string; label: string }> = [
  { kind: "course", label: "Courses" },
  { kind: "membership", label: "Coaching Passes" },
  { kind: "cohort", label: "Cohorts" },
  { kind: "group_coaching_series", label: "Group Coaching: a whole series" },
  { kind: "group_coaching_session", label: "Group Coaching: sessions of a series" },
  { kind: "private_coaching", label: "One-to-one coaching: sessions" },
  { kind: "retreat", label: "Retreats" },
  { kind: "event", label: "Events" },
  { kind: "playlist", label: "Playlists" },
];

export type GrantOption = { value: string; name: string };
export type GrantGroup = { kind: string; label: string; options: GrantOption[] };

/**
 * Everything that can be granted, by name, for the grant form (owner,
 * 2026-10-15): staff pick "Gold Coaching Pass" or a course by its title
 * instead of choosing a type and pasting an id. Each value is `kind:id`.
 */
export async function grantOptions(): Promise<GrantGroup[]> {
  const admin = createAdminClient();
  return Promise.all(
    GRANTABLE.map(async ({ kind, label }) => {
      const source = SOURCES[kind];
      const rows = await all<Record<string, string>>((from, to) =>
        // The table name comes from the fixed map above, never from a request.
        admin.from(source.table as "courses").select(`id,${source.label}`).order(source.label).range(from, to),
      );
      return {
        kind,
        label,
        options: rows.map((r) => ({ value: `${kind}:${r.id}`, name: r[source.label] })),
      };
    }),
  );
}

/** Whether a `kind:id` value names a kind that may be granted by hand. */
export function isGrantableKind(kind: string): boolean {
  return GRANTABLE.some((g) => g.kind === kind);
}
