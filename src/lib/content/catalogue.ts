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
  /** Edge of the cover kept when it is cropped to fill a frame (migration 0008_catalogue_and_site_media). */
  cover_focus: CoverFocus;
  /** The cover's pixel size (migration 0011), null when unknown. */
  cover_width: number | null;
  cover_height: number | null;
  /** Credit line owed with the cover (migration 0012), null when none. */
  cover_credit: string | null;
};

export type CoverShape = "portrait" | "square" | "landscape";

/**
 * The shape of a work's artwork, which decides how it is laid out: a poster on
 * the wall, or a two-column still (note 10 §42.1). Unknown dimensions count as
 * portrait — the frame everything used before shapes were recorded.
 */
export function coverShape(item: Pick<CatalogueItem, "cover_width" | "cover_height">): CoverShape {
  if (!item.cover_width || !item.cover_height) return "portrait";
  const ratio = item.cover_width / item.cover_height;
  if (ratio >= 1.15) return "landscape";
  if (ratio > 0.9) return "square";
  return "portrait";
}

/**
 * Collections whose covers are show artwork — podcast and radio art, video
 * thumbnails — lettered edge to edge. Their square and landscape covers are
 * shown WHOLE inside the 3:4 poster frame (`showsWhole`), because a crop cuts
 * the lettering and a still's overlaid title collides with it. Books and
 * films keep their chosen `cover_focus` crops and their two-column stills.
 */
// Watch is deliberately absent: its covers are plain video frames with no
// lettering, which read best as full-width stills.
const SHOW_ARTWORK = new Set(["podcasts", "interviews", "audio"]);

export function showsWhole(
  item: Pick<CatalogueItem, "category" | "storage_path" | "cover_width" | "cover_height">,
): boolean {
  return Boolean(item.storage_path) && SHOW_ARTWORK.has(item.category) && coverShape(item) !== "portrait";
}

/** How a work sits on a wall: a poster, or a landscape still across two columns. */
export function wallForm(
  item: Pick<CatalogueItem, "category" | "storage_path" | "cover_width" | "cover_height">,
): "poster" | "still" {
  return item.storage_path && coverShape(item) === "landscape" && !showsWhole(item) ? "still" : "poster";
}

export type CoverFocus = "top" | "center" | "left" | "right";

/**
 * object-position per focus. Written out in full rather than built from the
 * value, so Tailwind's scanner sees every class it has to generate.
 */
export const COVER_FOCUS_CLASS: Record<CoverFocus, string> = {
  top: "object-top",
  center: "object-center",
  left: "object-left",
  right: "object-right",
};

/**
 * Whether a work has a page of its own. It needs body copy: a title, one line
 * and a cover already appear in full on the card, so a page holding only those
 * would be an empty click. Works gain a page the moment they gain text.
 */
export function hasOwnPage(item: Pick<CatalogueItem, "body">): boolean {
  return Boolean(item.body?.trim());
}

/**
 * Where a work's card leads: its external home, its own page, or nowhere.
 * Every link to a work goes through this, so cards, curated lists and the
 * sitemap cannot disagree about which works have pages.
 */
export function workHref(
  item: Pick<CatalogueItem, "category" | "slug" | "body" | "is_external" | "external_url">,
): { href: string; external: boolean } | null {
  if (item.is_external && item.external_url) return { href: item.external_url, external: true };
  if (hasOwnPage(item)) return { href: `/catalogue/${item.category}/${item.slug}`, external: false };
  return null;
}

/**
 * A recording or video listed ahead of its link (owner, 2026-09-26): shown on
 * its collection's wall with its cover and marked "Coming soon", but not
 * clickable, because the file is still being uploaded to the video host.
 * Books and films without a page of their own are unlinked too, but that is
 * permanent, not pending, so only the media collections are marked.
 */
const MEDIA_COLLECTIONS = new Set(["watch", "interviews", "podcasts", "audio"]);

export function awaitingLink(
  item: Pick<CatalogueItem, "category" | "slug" | "body" | "is_external" | "external_url">,
): boolean {
  return MEDIA_COLLECTIONS.has(item.category) && workHref(item) === null;
}

type CoverEmbed = {
  storage_path?: string | null;
  width?: number | null;
  height?: number | null;
  credit?: string | null;
};

/**
 * PostgREST returns an embedded one-to-one as an object while the generated
 * types call it an array. Only paths in PUBLIC buckets come back at all —
 * `resources` restricts the rest (migration 0006_public_content_and_benefits) — so an unassigned or private
 * cover simply yields null and the image is not rendered.
 */
function coverPath(embed: CoverEmbed | CoverEmbed[] | null | undefined): string | null {
  return coverOf(embed)?.storage_path ?? null;
}

function coverOf(embed: CoverEmbed | CoverEmbed[] | null | undefined): CoverEmbed | null {
  if (!embed) return null;
  return (Array.isArray(embed) ? embed[0] : embed) ?? null;
}

/** The cover fields every item carries, resolved from the joined resource. */
function withCover<T extends { resources?: CoverEmbed | CoverEmbed[] | null }>(row: T) {
  const cover = coverOf(row.resources);
  return {
    ...row,
    storage_path: cover?.storage_path ?? null,
    cover_width: cover?.storage_path ? (cover.width ?? null) : null,
    cover_height: cover?.storage_path ? (cover.height ?? null) : null,
    cover_credit: cover?.storage_path ? (cover.credit ?? null) : null,
  };
}

type RawItem = CatalogueItem & { resources?: CoverEmbed | CoverEmbed[] | null };

function mapItems(data: unknown): CatalogueItem[] {
  return ((data ?? []) as RawItem[]).map(withCover);
}

const ITEM_COLUMNS =
  "id,category,title,slug,description,body,is_external,external_url,published_at,tags,cover_focus," +
  // The cover is joined rather than fetched per item: a category page renders
  // every item, so one query per cover is one round trip per row.
  //
  // THE FOREIGN KEY IS NAMED EXPLICITLY. `catalogue_items` reaches `resources`
  // two ways — directly via cover_resource_id, and many-to-many through
  // `catalogue_item_resources` — so a bare `resources(...)` is ambiguous and
  // PostgREST rejects the whole query with PGRST201. That failure is silent
  // here: `data` comes back null and the page renders as though nothing were
  // published.
  "resources!catalogue_items_cover_resource_id_fkey(storage_path,width,height,credit)";

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
  return mapItems(data);
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

export type CatalogueGalleryImage = { storage_path: string; credit: string | null };
export type CatalogueLink = { label: string; url: string };
/** A hosted recording of the work, in play order (note 08 §60.1). */
export type CatalogueAudio = { storage_path: string; title: string };

type ExtraResource = {
  storage_path: string | null;
  credit: string | null;
  resource_type: string;
  title: string;
};

/**
 * The detail page's extras: further images of the work, its hosted
 * recordings, and where to buy, listen or read more. Kept out of ITEM_COLUMNS
 * because only the single-work page needs them — listing pages would fetch
 * every gallery for nothing.
 *
 * Images and recordings share one join, `catalogue_item_resources`, told
 * apart by `resource_type`: an interview with two parts is two rows, and the
 * gallery must never try to render an MP3 as a picture. The embed names its
 * foreign key for the same reason ITEM_COLUMNS does. A resource outside a
 * public bucket comes back null under RLS and is dropped, as covers are.
 */
export async function getCatalogueItemExtras(
  itemId: string,
): Promise<{ gallery: CatalogueGalleryImage[]; audio: CatalogueAudio[]; links: CatalogueLink[] }> {
  const supabase = await createClient();

  const [resourcesRes, linksRes] = await Promise.all([
    supabase
      .from("catalogue_item_resources")
      .select(
        "position, resources!catalogue_item_resources_resource_id_fkey(storage_path,credit,resource_type,title)",
      )
      .eq("catalogue_item_id", itemId)
      .order("position", { ascending: true }),
    supabase
      .from("catalogue_item_links")
      .select("label, url")
      .eq("catalogue_item_id", itemId)
      .order("position", { ascending: true }),
  ]);

  const resources = ((resourcesRes.data ?? []) as unknown as Array<{
    resources: ExtraResource | ExtraResource[] | null;
  }>)
    .map((row) => (Array.isArray(row.resources) ? row.resources[0] : row.resources))
    .filter((r): r is ExtraResource & { storage_path: string } => Boolean(r?.storage_path));

  const gallery = resources
    .filter((r) => r.resource_type !== "audio")
    .map((r) => ({ storage_path: r.storage_path, credit: r.credit ?? null }));
  const audio = resources
    .filter((r) => r.resource_type === "audio")
    .map((r) => ({ storage_path: r.storage_path, title: r.title }));

  return { gallery, audio, links: (linksRes.data ?? []) as CatalogueLink[] };
}

/** How many published works sit in each category, for the hub page. */
export async function catalogueCounts(): Promise<Record<string, number>> {
  const items = await listCatalogue();
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Other pictures of a short collection's own works, to fill its fan before a
 * plain sleeve does: each work's gallery first, then the cover and gallery of
 * the same title's other editions elsewhere in the catalogue — "The Butterfly
 * Boy — the audiobook" draws on the book (owner, 2026-09-26). Nothing from an
 * unrelated work, and nothing already in the fan.
 */
export async function fanFillers(works: CatalogueItem[], all: CatalogueItem[]): Promise<string[]> {
  const pictured = works.filter((w) => w.storage_path);
  if (pictured.length >= 3) return [];

  const stem = (title: string) => title.split(" — ")[0].trim().toLowerCase();
  const titles = new Set(pictured.map((w) => stem(w.title)));
  const own = new Set(works.map((w) => w.id));
  const editions = all.filter((item) => !own.has(item.id) && titles.has(stem(item.title)));

  const galleries = await Promise.all(
    [...pictured, ...editions].map(async (w) => (await getCatalogueItemExtras(w.id)).gallery.map((g) => g.storage_path)),
  );
  const theirs = galleries.slice(0, pictured.length).flat();
  const others = editions.flatMap((e, i) => [e.storage_path, ...galleries[pictured.length + i]]);

  const seen = new Set(pictured.map((w) => w.storage_path));
  return [...theirs, ...others].filter((path): path is string => {
    if (!path || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}
