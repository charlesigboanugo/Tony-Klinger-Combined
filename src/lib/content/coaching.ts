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
   * What this tier ADDS over the one below it (note 07 §10).
   *
   * Deliberately not the full effective list: tiers are cumulative, so storing
   * every tier's complete benefits would repeat Silver's three lines four times
   * and let the copies drift. Use `effectiveBenefits` to resolve the full set.
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
};

/**
 * Every benefit a tier grants, resolved by walking the ladder upward.
 *
 * Gold ⊃ Silver, Platinum ⊃ Gold, Ultimate ⊃ Platinum (note 07 §10). The page
 * must show a Gold buyer that they get Silver's series too, because that is
 * what they are paying for — but the data must not repeat it.
 */
export function effectiveBenefits(
  tiers: MembershipTier[],
  tier: MembershipTier,
): { fromRank: number; label: string }[] {
  return tiers
    .filter((t) => t.rank <= tier.rank)
    .sort((a, b) => a.rank - b.rank)
    .flatMap((t) => t.benefits.map((label) => ({ fromRank: t.rank, label })));
}

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
  starts_at: string | null;
  capacity: number | null;
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
  starts_at: string | null;
  capacity: number | null;
  requires_application: boolean;
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
      "id,tier,name,slug,description,rank,benefits,products(slug,status,prices(amount,currency,billing_type,interval,active))",
    )
    .eq("active", true)
    .order("rank", { ascending: true });

  return (
    (data ?? []) as unknown as Array<
      Omit<MembershipTier, "prices" | "productSlug"> & {
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

export async function listSeries(): Promise<Series[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("group_coaching_series")
    .select("id,name,slug,description,syllabus,resources!cover_resource_id(storage_path)")
    .eq("status", "published")
    .order("name");
  return (
    (data ?? []) as unknown as Array<Series & { resources?: CoverEmbed | CoverEmbed[] }>
  ).map((row) => ({ ...row, storagePath: coverPath(row.resources) }));
}

export async function getSeries(slug: string): Promise<Series | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("group_coaching_series")
    .select("id,name,slug,description,syllabus,resources!cover_resource_id(storage_path)")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Series & { resources?: CoverEmbed | CoverEmbed[] };
  return { ...row, storagePath: coverPath(row.resources) };
}

export async function listCohorts(): Promise<Cohort[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("cohorts")
    .select("id,name,slug,description,cohort_level,starts_at,capacity,benefits,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))")
    .eq("status", "published")
    .order("starts_at", { ascending: true, nullsFirst: false });

  return ((data ?? []) as unknown as Array<Cohort & { products: Embedded; resources?: CoverEmbed | CoverEmbed[] }>).map(
    (row) => ({
      ...row,
      prices: activePrices(row.products),
      storagePath: coverPath(row.resources),
      productSlug: productSlugOf(row.products),
    }),
  );
}

/** A single published cohort by slug, or null. Powers the detail page. */
export async function getCohort(slug: string): Promise<Cohort | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("cohorts")
    .select("id,name,slug,description,cohort_level,starts_at,capacity,benefits,resources!cover_resource_id(storage_path),products(slug,status,prices(amount,currency,billing_type,interval,active))")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Cohort & { products: Embedded; resources?: CoverEmbed | CoverEmbed[] | null };
  return {
    ...row,
    prices: activePrices(row.products),
    storagePath: coverPath(row.resources),
    productSlug: productSlugOf(row.products),
  };
}

export async function listRetreats(): Promise<Retreat[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("retreats")
    .select("id,name,slug,description,starts_at,capacity,requires_application,resources!cover_resource_id(storage_path),products(slug,status)")
    .eq("status", "published")
    .order("starts_at", { ascending: true, nullsFirst: false });
  return (
    (data ?? []) as unknown as Array<Retreat & { resources?: CoverEmbed | CoverEmbed[] }>
  ).map((row) => ({ ...row, storagePath: coverPath(row.resources) }));
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


