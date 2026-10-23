import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

/**
 * Coaching storefront queries — note 03 §9–§16, note 07.
 *
 * `/coaching` sells; `/academy` delivers. Nothing here returns lesson content
 * or any other protected material (note 07 §37).
 */

export type Price = {
  amount: number;
  currency: string;
  billing_type: string;
  interval: string | null;
};

export type MembershipTier = {
  id: string;
  tier: string;
  name: string;
  slug: string;
  description: string | null;
  rank: number;
  /**
   * Active prices for this tier's product.
   *
   * A tier legitimately has TWO: a monthly subscription and a one-year one-off,
   * which is how they are sold on the storefront. Kept as a list rather than a
   * single "price" so the page can show both rather than silently picking one.
   */
  prices: ProductPrice[];
  /**
   * Everything this tier includes, in order — the FULL list, not what it adds
   * over the tier below (migration 0012, owner 2026-10-08).
   *
   * Tiers are cumulative in what they GRANT, but not in how they READ: a higher
   * tier supersedes lines below it (one playlist becomes every playlist, one
   * series becomes two) rather than adding to them, so a list built by walking
   * the ladder states the same benefit twice at different sizes. Each tier
   * therefore carries its own complete list.
   */
  benefits: string[];

  /**
   * The slug of the PRODUCT this tier sells, which is not the tier's own slug.
   *
   * The tier is `gold`; the product is `membership-gold`. Every purchase link
   * has to use the product slug, because that is what the order pipeline
   * resolves against. Using the tier slug sent customers to a checkout page
   * that could find nothing to sell and rendered "Nothing to check out" — so
   * membership was unbuyable through the site.
   *
   * Null when a tier has no product attached (Ultimate, which has no price).
   */
  productSlug: string | null;

  /** Group Coaching series a member may register for in each membership year; null for no limit. */
  seriesAllowance: number | null;
  /** Playlists a member holds: a number they choose, or null for every playlist. */
  playlistAllowance: number | null;
  includesQa: boolean;
  includesRetreats: boolean;
  /** Retreats are for members paying by the year, not by the month. */
  retreatsRequireYearly: boolean;
};

/** An active price on a product. */
export type ProductPrice = {
  amount: number;
  currency: string;
  billing_type: string;
  interval: string | null;
};

/**
 * PostgREST returns an embedded one-to-one as an object while the generated
 * types describe it as an array. Normalised in one place rather than at each
 * call site, and inactive prices are dropped — a superseded amount must never
 * be shown as though it were still purchasable.
 */
type Embedded = {
  prices?: Array<ProductPrice & { active: boolean }>;
  /** Selected alongside prices so purchase links can use the product slug. */
  slug?: string | null;
  status?: string | null;
};
export function activePrices(
  product: Embedded | Embedded[] | null | undefined,
): ProductPrice[] {
  if (!product) return [];
  const first = Array.isArray(product) ? product[0] : product;
  return (first?.prices ?? []).filter((p) => p.active);
}


/**
 * The cover image path from a named `resources` embed.
 *
 * PostgREST returns a one-to-one embed as an object while the generated types
 * describe it as an array — the same normalisation `activePrices` needs. Only
 * PUBLIC-bucket paths come back at all (migration 0006_public_content_and_benefits), so an unassigned or
 * private cover simply yields null and the image is not rendered.
 */
type CoverEmbed = { storage_path?: string | null };
export function coverPath(
  embed: CoverEmbed | CoverEmbed[] | null | undefined,
): string | null {
  if (!embed) return null;
  const first = Array.isArray(embed) ? embed[0] : embed;
  return first?.storage_path ?? null;
}


/**
 * The PRODUCT slug behind a storefront entity, which is NOT the entity's slug.
 *
 * `level-one` is a course; `course-level-one` is the product that sells it.
 * `advanced-one-to-one` is a service; `one-to-one-single` is its product. Every
 * purchase link must use the product slug, because that is what the order
 * pipeline resolves — building one from the entity slug produces a checkout
 * page that finds nothing to sell and says "Nothing to check out".
 *
 * Null unless the product is ACTIVE: offering a link to a paused or archived
 * product fails at checkout for a different reason, which is no better.
 */
type ProductRef = { slug?: string | null; status?: string | null };
export function productSlugOf(
  embed: ProductRef | ProductRef[] | null | undefined,
): string | null {
  if (!embed) return null;
  const first = Array.isArray(embed) ? embed[0] : embed;
  if (!first || first.status !== "active") return null;
  return first.slug ?? null;
}

export type Course = {
  /** Slug of the product that sells this. Null when not buyable. */
  productSlug: string | null;
  /** Cover image path, or null when none is assigned. */
  storagePath: string | null;
  id: string;
  title: string;
  slug: string;
  description: string | null;
  /** Place in the sequence ("Level Two"), shown as a label, not the title (migration 0016). */
  level: string | null;
  product_id: string | null;
  prices: ProductPrice[];
};

export type Series = {
  /** Cover image path, or null when none is assigned. */
  storagePath: string | null;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The curriculum — ordered session topics. Not scheduled dates (note 07 §11). */
  syllabus: string[];
  /** Places in each session. Set in admin (migration 0012), never assumed. */
  capacity: number;
};

export type Cohort = {
  /** Slug of the product that sells this. Null when not buyable. */
  productSlug: string | null;
  /** Cover image path, or null when none is assigned. */
  storagePath: string | null;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cohort_level: string;
  /** Order on the site, lowest first. */
  rank: number;
  prices: ProductPrice[];
  benefits: string[];
};

export type Retreat = {
  /** Slug of the product that sells this. Null when not buyable. */
  productSlug: string | null;
  /** Cover image path, or null when none is assigned. */
  storagePath: string | null;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /**
   * The dates and places of the batch the page leads with: the one under way,
   * or else the next to come (migration 0030). Null when no batch is set.
   */
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  /** That batch's name, e.g. "Spring 2027". */
  batchLabel: string | null;
  /** Every batch still to finish, soonest first. */
  batches: RetreatBatch[];
  requires_application: boolean;
  /** Place on the retreat's ladder (1, 2, 3), or null where it has no levels. */
  level: number | null;
  /** What this retreat or level includes, in order. */
  benefits: string[];
  prices: ProductPrice[];
  /** Begun and not yet over: visible, but closed to new bookings. */
  inProgress: boolean;
  /** Its start has passed (under way, or over). Read from the clock here, not in render. */
  begun: boolean;
  /**
   * With nothing still to come: when the last batch ended, so the page can say
   * it has run rather than "to be announced" (owner, 2026-10-23). Null while a
   * batch is still to finish, and for a retreat that has never had one.
   */
  endedAt: string | null;
};

/** One running of a retreat, as the public may see it: no joining link. */
export type RetreatBatch = {
  id: string;
  label: string;
  registrationOpensAt: string;
  registrationClosesAt: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
};

export type CoachingService = {
  /** Slug of the product that sells this. Null when not buyable. */
  productSlug: string | null;
  /** Cover image path, or null when none is assigned. */
  storagePath: string | null;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  benefits: string[];
  duration_minutes: number;
  prices: ProductPrice[];
};

/** Membership tiers in ladder order — cumulative (note 07 §10). */
export async function listMembershipTiers(): Promise<MembershipTier[]> {
  const supabase = createPublicClient();
  // Joined rather than fetched per tier: four sequential price queries on a
  // page that always renders all four is four round trips for one answer.
  const { data } = await supabase
    .from("membership_tiers")
    .select(
      "id,tier,name,slug,description,rank,benefits,series_allowance,playlist_allowance,includes_qa,includes_retreats,retreats_require_yearly,products(slug,status,prices(amount,currency,billing_type,interval,active))",
    )
    .eq("active", true)
    .order("rank", { ascending: true });

  return (
    (data ?? []) as unknown as Array<
      Omit<
        MembershipTier,
        | "prices"
        | "productSlug"
        | "seriesAllowance"
        | "playlistAllowance"
        | "includesQa"
        | "includesRetreats"
        | "retreatsRequireYearly"
      > & {
        retreats_require_yearly: boolean;
        series_allowance: number | null;
        playlist_allowance: number | null;
        includes_qa: boolean;
        includes_retreats: boolean;
        products?:
          | (Embedded & { slug?: string | null; status?: string | null })
          | Array<Embedded & { slug?: string | null; status?: string | null }>
          | null;
      }
    >
  ).map((row) => {
    // PostgREST returns a one-to-one embed as an object; the generated types
    // call it an array (see `activePrices`). Normalised the same way here.
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      id: row.id,
      tier: row.tier,
      name: row.name,
      slug: row.slug,
      description: row.description,
      rank: row.rank,
      benefits: row.benefits ?? [],
      prices: activePrices(row.products),
      // Only an ACTIVE product is buyable; offering a link to a paused or
      // archived one would fail at checkout for a different reason.
      productSlug:
        product && product.status === "active" ? (product.slug ?? null) : null,
      seriesAllowance: row.series_allowance,
      playlistAllowance: row.playlist_allowance,
      includesQa: row.includes_qa,
      includesRetreats: row.includes_retreats,
      retreatsRequireYearly: row.retreats_require_yearly,
    };
  });
}

/**
 * Active price looked up by product SLUG.
 *
 * Group Coaching is priced per PRODUCT, not per series — one session and an
 * eight-session bundle, both of which apply to every series (note 07 §14) — so
 * a series page needs the price without holding a product id of its own.
 */
export async function priceForProductSlug(slug: string): Promise<Price | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select("prices(amount,currency,billing_type,interval,active)")
    .eq("slug", slug)
    .maybeSingle();

  const rows = (data as { prices?: Array<Price & { active: boolean }> } | null)?.prices ?? [];
  const active = rows.filter((r) => r.active);
  if (active.length === 0) return null;
  return active.reduce((a, b) => (a.amount <= b.amount ? a : b));
}

/** Active price for a product, if it has one. */
export async function priceForProduct(
  productId: string | null,
): Promise<Price | null> {
  if (!productId) return null;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("prices")
    .select("amount,currency,billing_type,interval")
    .eq("product_id", productId)
    .eq("active", true)
    .order("amount", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Price | null) ?? null;
}

export async function listCourses(): Promise<Course[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("courses")
    .select("id,title,slug,description,level,product_id,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))")
    .eq("status", "published")
    // Curated order (owner, 2026-09-26: How to Get Your Movie Made leads).
    .order("position")
    .order("title");

  return (
    (data ?? []) as unknown as Array<
      Course & { products: Embedded; resources?: CoverEmbed | CoverEmbed[] }
    >
  ).map((row) => ({
    ...row,
    prices: activePrices(row.products),
    storagePath: coverPath(row.resources),
    productSlug: productSlugOf(row.products),
  }));
}

export async function getCourse(slug: string): Promise<Course | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("courses")
    .select("id,title,slug,description,level,product_id,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Course & {
    resources?: CoverEmbed | CoverEmbed[];
    products?: Embedded | Embedded[];
  };
  return {
    ...row,
    storagePath: coverPath(row.resources),
    productSlug: productSlugOf(row.products),
    prices: activePrices(row.products),
  };
}

const SERIES_SELECT =
  "id,name,slug,description,syllabus,capacity,resources!cover_resource_id(storage_path)";

type SeriesRow = Omit<Series, "storagePath"> & { resources?: CoverEmbed | CoverEmbed[] };

function toSeries(row: SeriesRow): Series {
  return { ...row, storagePath: coverPath(row.resources) };
}

export async function listSeries(): Promise<Series[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("group_coaching_series")
    .select(SERIES_SELECT)
    .eq("status", "published")
    .order("name");
  return ((data ?? []) as unknown as SeriesRow[]).map(toSeries);
}

export async function getSeries(slug: string): Promise<Series | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("group_coaching_series")
    .select(SERIES_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  return data ? toSeries(data as unknown as SeriesRow) : null;
}

/**
 * A run of a series, as the public sees it — migration 0016.
 *
 *   upcoming      registration has not opened yet
 *   open          registration is open and there is a place
 *   full          registration is open and every place is taken
 *   sessions      registration for the series has closed ahead of the start
 *                 (migration 0025): the seats left are sold as single sessions
 *   in_progress   it has started: shown, closed to new people; single sessions
 *                 still to come are sold
 *
 * A run that has ended is not returned at all.
 */
export type SeriesRun = {
  id: string;
  seriesId: string;
  label: string;
  registrationOpensAt: string;
  /** When Coaching Pass holders can register, ahead of everyone (migration 0026). */
  passOpensAt: string;
  /** When the series stops selling and its single sessions start. The start, unless set earlier. */
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  placesLeft: number;
  state: "upcoming" | "open" | "full" | "sessions" | "in_progress";
};

/** Every run still to finish, for these series, soonest first. */
export async function listRuns(seriesIds: string[]): Promise<SeriesRun[]> {
  if (seriesIds.length === 0) return [];
  const supabase = createPublicClient();
  const now = Date.now();

  const { data } = await supabase
    .from("coaching_runs")
    .select("id,series_id,label,pass_opens_at,registration_opens_at,registration_closes_at,starts_at,ends_at,capacity")
    .in("series_id", seriesIds)
    .eq("status", "published")
    .gt("ends_at", new Date(now).toISOString())
    .order("starts_at");

  return Promise.all(
    (data ?? []).map(async (r) => {
      const started = +new Date(r.starts_at) <= now;
      const opened = +new Date(r.registration_opens_at) <= now;
      const closed = +new Date(r.registration_closes_at) <= now;
      // Only an open run needs counting; the answer for the others is fixed.
      const { data: left } =
        !started && opened && !closed ? await supabase.rpc("run_places_left", { p_run_id: r.id }) : { data: null };
      const placesLeft = typeof left === "number" ? left : r.capacity;
      return {
        id: r.id,
        seriesId: r.series_id,
        label: r.label,
        registrationOpensAt: r.registration_opens_at,
        passOpensAt: r.pass_opens_at,
        registrationClosesAt: r.registration_closes_at,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        capacity: r.capacity,
        placesLeft,
        state: started ? "in_progress" : !opened ? "upcoming" : closed ? "sessions" : placesLeft > 0 ? "open" : "full",
      } satisfies SeriesRun;
    }),
  );
}

/**
 * A session of a series that can be bought singly — migration 0022.
 *
 * One Group Coaching session is bought FOR A DATE (owner, 2026-10-09): the
 * series page lists these and the buyer picks one as they pay. Still to come,
 * on a run whose registration has opened; the series may already be running.
 */
export type ComingSession = {
  id: string;
  title: string | null;
  startsAt: string;
  runLabel: string;
  placesLeft: number;
};

export async function listComingSessions(seriesId: string): Promise<ComingSession[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("coming_sessions", { p_series_id: seriesId });
  return ((data ?? []) as Array<{ id: string; title: string | null; starts_at: string; run_label: string; places_left: number }>).map(
    (s) => ({ id: s.id, title: s.title, startsAt: s.starts_at, runLabel: s.run_label, placesLeft: s.places_left }),
  );
}

const DAY_MS = 86_400_000;

/**
 * When a retreat is over, where no end was entered: it is taken to run one
 * day. Entering `ends_at` in admin is always better; this only stops a row
 * with none from being listed for ever.
 */
const ASSUMED_RETREAT_MS = DAY_MS;

function isInProgress(row: { starts_at: string | null; ends_at: string | null }, now: number, assumedMs: number) {
  if (!row.starts_at || +new Date(row.starts_at) > now) return false;
  const end = row.ends_at ? +new Date(row.ends_at) : +new Date(row.starts_at) + assumedMs;
  return end > now;
}

const COHORT_SELECT =
  "id,name,slug,description,cohort_level,rank,benefits,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))";

type CohortRow = Omit<Cohort, "prices" | "storagePath" | "productSlug"> & {
  products: Embedded;
  resources?: CoverEmbed | CoverEmbed[] | null;
};

function toCohort(row: CohortRow): Cohort {
  return {
    ...row,
    prices: activePrices(row.products),
    storagePath: coverPath(row.resources),
    productSlug: productSlugOf(row.products),
  };
}

/**
 * The cohorts. They are FIXED (migration 0017): a cohort is always listed, and
 * whether it can be joined is decided by its intakes (`listIntakes`), not by
 * the cohort. Before intakes a cohort row was one running of it and left this
 * list when it ended; a new running is now a new intake, not a new cohort.
 */
export async function listCohorts(): Promise<Cohort[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("cohorts").select(COHORT_SELECT).eq("status", "published").order("name");

  return ((data ?? []) as unknown as CohortRow[])
    .map(toCohort)
    // In the order the levels are taken: each cohort's `rank`, which staff set
    // (migration 0029; it was a fixed Silver, Gold, Platinum list here).
    .sort((a, b) => a.rank - b.rank);
}

/** A single published cohort by slug, or null. Powers the detail page. */
export async function getCohort(slug: string): Promise<Cohort | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  return data ? toCohort(data as unknown as CohortRow) : null;
}

/**
 * An intake of a cohort, as the public sees it — migration 0017. The same four
 * states as a series run; one that has ended is not returned.
 */
export type CohortIntake = {
  id: string;
  cohortId: string;
  label: string;
  registrationOpensAt: string;
  startsAt: string;
  endsAt: string;
  /** Null where the intake has no limit: the page then says nothing of size. */
  capacity: number | null;
  placesLeft: number | null;
  state: "upcoming" | "open" | "full" | "in_progress";
};

/** Every intake still to finish, for these cohorts, soonest first. */
export async function listIntakes(cohortIds: string[]): Promise<CohortIntake[]> {
  if (cohortIds.length === 0) return [];
  const supabase = createPublicClient();
  const now = Date.now();

  const { data } = await supabase
    .from("cohort_intakes")
    .select("id,cohort_id,label,registration_opens_at,starts_at,ends_at,capacity")
    .in("cohort_id", cohortIds)
    .eq("status", "published")
    .gt("ends_at", new Date(now).toISOString())
    .order("starts_at");

  return Promise.all(
    (data ?? []).map(async (i) => {
      const started = +new Date(i.starts_at) <= now;
      const opened = +new Date(i.registration_opens_at) <= now;
      const { data: left } =
        !started && opened && i.capacity != null
          ? await supabase.rpc("intake_places_left", { p_intake_id: i.id })
          : { data: null };
      const placesLeft = i.capacity == null ? null : typeof left === "number" ? left : i.capacity;
      return {
        id: i.id,
        cohortId: i.cohort_id,
        label: i.label,
        registrationOpensAt: i.registration_opens_at,
        startsAt: i.starts_at,
        endsAt: i.ends_at,
        capacity: i.capacity,
        placesLeft,
        state: started ? "in_progress" : !opened ? "upcoming" : placesLeft === 0 ? "full" : "open",
      } satisfies CohortIntake;
    }),
  );
}

const RETREAT_SELECT =
  "id,name,slug,description,requires_application,level,benefits,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))";

type RetreatRow = Omit<
  Retreat,
  "prices" | "storagePath" | "productSlug" | "inProgress" | "begun" | "starts_at" | "ends_at" | "capacity" | "batchLabel" | "batches"
> & {
  products?: Embedded | Embedded[] | null;
  resources?: CoverEmbed | CoverEmbed[] | null;
};

type BatchRow = {
  id: string;
  retreat_id: string;
  label: string;
  registration_opens_at: string;
  registration_closes_at: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
};

/**
 * The published batches of these retreats that have not finished, by
 * retreat. Read through `retreat_batch_dates`, which leaves the joining link
 * out: a batch row itself is not public (migration 0030).
 */
async function batchesFor(
  retreatIds: string[],
  now: number,
): Promise<{ byRetreat: Map<string, RetreatBatch[]>; lastEnded: Map<string, string> }> {
  const byRetreat = new Map<string, RetreatBatch[]>();
  const lastEnded = new Map<string, string>();
  if (retreatIds.length === 0) return { byRetreat, lastEnded };
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("retreat_batch_dates", { p_retreat_ids: retreatIds });
  for (const b of (data ?? []) as BatchRow[]) {
    if (+new Date(b.ends_at) <= now) {
      const seen = lastEnded.get(b.retreat_id);
      if (!seen || b.ends_at > seen) lastEnded.set(b.retreat_id, b.ends_at);
      continue;
    }
    byRetreat.set(b.retreat_id, [
      ...(byRetreat.get(b.retreat_id) ?? []),
      {
        id: b.id,
        label: b.label,
        registrationOpensAt: b.registration_opens_at,
        registrationClosesAt: b.registration_closes_at,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        capacity: b.capacity,
      },
    ]);
  }
  return { byRetreat, lastEnded };
}

function toRetreat(row: RetreatRow, batches: RetreatBatch[], now: number, lastEnded: string | null = null): Retreat {
  // The batch the page leads with: the first still to finish (soonest first,
  // so one under way comes before one to come).
  const lead = batches[0] ?? null;
  const dated = { starts_at: lead?.startsAt ?? null, ends_at: lead?.endsAt ?? null };
  return {
    ...row,
    ...dated,
    capacity: lead?.capacity ?? null,
    batchLabel: lead?.label ?? null,
    batches,
    inProgress: isInProgress(dated, now, ASSUMED_RETREAT_MS),
    begun: Boolean(dated.starts_at && +new Date(dated.starts_at) <= now),
    endedAt: lead ? null : lastEnded,
    benefits: row.benefits ?? [],
    prices: activePrices(row.products),
    storagePath: coverPath(row.resources),
    productSlug: productSlugOf(row.products),
  };
}

/**
 * Retreats on the programme, in their own order — a retreat's levels run 1, 2,
 * 3. A retreat is FIXED and always listed (migration 0030): each time it runs
 * is a batch, and its dates are those of the batch it leads with, or none yet.
 */
export async function listRetreats(): Promise<Retreat[]> {
  const supabase = createPublicClient();
  const now = Date.now();
  const { data } = await supabase
    .from("retreats")
    .select(RETREAT_SELECT)
    .eq("status", "published")
    .order("position")
    .order("name");
  const rows = (data ?? []) as unknown as RetreatRow[];
  const { byRetreat, lastEnded } = await batchesFor(rows.map((r) => r.id), now);
  return rows.map((row) => toRetreat(row, byRetreat.get(row.id) ?? [], now, lastEnded.get(row.id) ?? null));
}

/** A single published retreat by slug, or null. Powers the detail page. */
export async function getRetreat(slug: string): Promise<Retreat | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("retreats")
    .select(RETREAT_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as RetreatRow;
  const now = Date.now();
  const { byRetreat, lastEnded } = await batchesFor([row.id], now);
  return toRetreat(row, byRetreat.get(row.id) ?? [], now, lastEnded.get(row.id) ?? null);
}

export type Playlist = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The lowest membership tier that may hold it. */
  min_tier: string;
};

/**
 * The members' playlists, by name and description only — what a visitor
 * comparing tiers may know. The videos themselves are delivery, and are read
 * in the Academy behind the access check (lib/academy/membership).
 */
export async function listPlaylists(): Promise<Playlist[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("playlists")
    .select("id,name,slug,description,min_tier")
    .eq("status", "published")
    .order("position")
    .order("name");
  return (data ?? []) as Playlist[];
}

export async function listCoachingServices(): Promise<CoachingService[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("private_coaching_services")
    .select("id,name,slug,description,benefits,duration_minutes,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))")
    .eq("status", "published")
    .order("name");
  return ((data ?? []) as unknown as Array<Omit<CoachingService, "prices" | "storagePath" | "productSlug"> & { products?: Embedded | Embedded[] | null; resources?: CoverEmbed | CoverEmbed[] | null }>)
    .map((row) => ({
      ...row,
      prices: activePrices(row.products),
      storagePath: coverPath(row.resources),
      productSlug: productSlugOf(row.products),
    }));
}

/** A single published service by slug, or null. Powers the detail page. */
export async function getCoachingService(slug: string): Promise<CoachingService | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("private_coaching_services")
    .select("id,name,slug,description,benefits,duration_minutes,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Omit<CoachingService, "prices" | "storagePath" | "productSlug"> & { products?: Embedded | Embedded[] | null; resources?: CoverEmbed | CoverEmbed[] | null };
  return {
    ...row,
    prices: activePrices(row.products),
    storagePath: coverPath(row.resources),
    productSlug: productSlugOf(row.products),
  };
}


