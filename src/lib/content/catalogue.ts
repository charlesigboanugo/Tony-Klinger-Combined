import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Catalogue — note 03 §7–§8, note 08 §28.2.
 *
 * Seven categories, fixed. They are values in the database, not tables, so
 * adding a work never means adding a route or a migration.
 */
export const CATALOGUE_CATEGORIES = [
  { slug: "books", label: "Books" },
  { slug: "films", label: "Films" },
  { slug: "audio", label: "Audio" },
  { slug: "interviews", label: "Interviews" },
  { slug: "stories-from-the-front-line", label: "Stories From The Front Line" },
  { slug: "podcasts", label: "Podcasts" },
  { slug: "watch", label: "Watch" },
] as const;

export type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number]["slug"];

export function isCatalogueCategory(value: string): value is CatalogueCategory {
  return CATALOGUE_CATEGORIES.some((c) => c.slug === value);
}

export function categoryLabel(slug: string): string {
  return CATALOGUE_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export type CatalogueItem = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string | null;
  body: string | null;
  is_external: boolean;
  external_url: string | null;
  published_at: string | null;
  tags: string[];
  /** Cover image path, resolved from the joined resource. Null when unassigned. */
  storage_path: string | null;
};

type CoverEmbed = { storage_path?: string | null };

/**
 * PostgREST returns an embedded one-to-one as an object while the generated
 * types call it an array. Only paths in PUBLIC buckets come back at all —
 * `resources` restricts the rest (migration 0026) — so an unassigned or private
 * cover simply yields null and the image is not rendered.
 */
function coverPath(embed: CoverEmbed | CoverEmbed[] | null | undefined): string | null {
  if (!embed) return null;
  const first = Array.isArray(embed) ? embed[0] : embed;
  return first?.storage_path ?? null;
}

type RawItem = CatalogueItem & { resources?: CoverEmbed | CoverEmbed[] | null };

function mapItems(data: unknown): CatalogueItem[] {
  return ((data ?? []) as RawItem[]).map((row) => ({
    ...row,
    storage_path: coverPath(row.resources),
  }));
}

const ITEM_COLUMNS =
  "id,category,title,slug,description,body,is_external,external_url,published_at,tags," +
  // The cover is joined rather than fetched per item: a category page renders
  // every item, so one query per cover is one round trip per row.
  //
  // THE FOREIGN KEY IS NAMED EXPLICITLY. `catalogue_items` reaches `resources`
  // two ways — directly via cover_resource_id, and many-to-many through
  // `catalogue_item_resources` — so a bare `resources(...)` is ambiguous and
  // PostgREST rejects the whole query with PGRST201. That failure is silent
  // here: `data` comes back null and the page renders as though nothing were
  // published.
  "resources!catalogue_items_cover_resource_id_fkey(storage_path)";

/**
 * Published items only.
 *
 * The `status` filter is a convenience for the query planner and for clarity —
 * RLS already prevents an anonymous reader from seeing a draft, so a mistake
 * here cannot leak unpublished work (note 08 §28.2).
 */
export async function listCatalogue(category?: string): Promise<CatalogueItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("catalogue_items")
    .select(ITEM_COLUMNS)
    .eq("status", "published")
    .order("position", { ascending: true })
    .order("title", { ascending: true });

  if (category) query = query.eq("category", category);

  const { data } = await query;
  return ((data ?? []) as unknown as Array<CatalogueItem & { resources?: CoverEmbed | CoverEmbed[] }>).map(
    (row) => ({ ...row, storage_path: coverPath(row.resources) }),
  );
}

/**
 * Published items carrying a curation tag, in catalogue order.
 *
 * Tags curate, categories classify (note 08 §28.2.1). A work keeps one
 * canonical home in its category and gains views through its tags — this
 * never returns a duplicate of anything, only a different slice.
 *
 * `contains` maps to the GIN-indexed `@>` operator, so this stays an index
 * scan rather than a sequential filter.
 */
export async function listCatalogueByTag(tag: string): Promise<CatalogueItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("catalogue_items")
    .select(ITEM_COLUMNS)
    .eq("status", "published")
    .contains("tags", [tag])
    .order("position", { ascending: true })
    .order("title", { ascending: true });

  return mapItems(data);
}

export async function getCatalogueItem(
  category: string,
  slug: string,
): Promise<CatalogueItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogue_items")
    .select(ITEM_COLUMNS)
    .eq("status", "published")
    .eq("category", category)
    .eq("slug", slug)
    .maybeSingle();

  return data ? (mapItems([data])[0] ?? null) : null;
}

/** How many published works sit in each category, for the hub page. */
export async function catalogueCounts(): Promise<Record<string, number>> {
  const items = await listCatalogue();
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
}
