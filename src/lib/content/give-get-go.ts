import "server-only";

import { listCatalogueByTag, type CatalogueItem } from "@/lib/content/catalogue";

/**
 * Give-Get-Go — note 11.
 *
 * A NAVIGATION AND CONTENT GROUPING, not a separate application and not a
 * second copy of the catalogue. Each section is a VIEW over existing
 * `catalogue_items`; nothing is duplicated, and a work keeps its canonical
 * home in its own category.
 *
 * ONE PAGE (owner, 2026-09-25). The three sections were separate routes;
 * they are now sections of /give-get-go, and the old routes redirect to
 * their anchors (next.config.ts).
 *
 * Sections are filtered by TAG, not by category (note 08 §28.2.1, R25).
 * Categories classify — what a work IS, one of seven media types, fixed.
 * Tags curate — which collection a work APPEARS IN, editable per work.
 *
 * The distinction is load-bearing here: no section is a whole category. Note
 * 11 describes Publishing as "the Give-Get-Go Books publishing imprint", a
 * subset of `books` rather than all of Tony's books, and Films is the same.
 * A category mapping would have shown unrelated works under a Give-Get-Go
 * banner. Documentaries had no category at all — a documentary is a film,
 * living at /catalogue/films/[slug] and surfacing here by tag.
 */
export type GiveGetGoSection = {
  /** The section's anchor on /give-get-go (and its old route's slug). */
  slug: string;
  label: string;
  description: string;
  /** Curation tag on `catalogue_items` that selects this section's works. */
  tag: string;
  /** Where to send someone who wants the full, unfiltered collection. */
  catalogueHref?: string;
};

export const GIVE_GET_GO_SECTIONS: readonly GiveGetGoSection[] = [
  {
    slug: "publishing",
    label: "Publishing",
    description:
      "Books, forthcoming titles and the Give-Get-Go Books imprint.",
    tag: "give-get-go:publishing",
    catalogueHref: "/catalogue/books",
  },
  {
    slug: "films",
    label: "Films",
    description: "Feature films and the projects behind them.",
    tag: "give-get-go:films",
    catalogueHref: "/catalogue/films",
  },
  {
    slug: "documentaries",
    label: "Documentaries",
    description: "Documentary work made under the Give-Get-Go banner.",
    // A documentary is a film, so these are `films` rows carrying this tag.
    // They are reached at /catalogue/films/[slug]; this section is a curated
    // view over them, never a second copy.
    tag: "give-get-go:documentaries",
    catalogueHref: "/catalogue/films",
  },
] as const;

export type GiveGetGoShelf = GiveGetGoSection & { items: CatalogueItem[] };

/**
 * Every section with its published works, in section order — the whole of
 * /give-get-go in one call.
 *
 * ONE PAGE, SO NO WORK TWICE. The documentaries are also tagged into Films
 * (a documentary is a film), which was harmless when each section had its own
 * page. On one page it would show the same poster in two consecutive
 * sections, so Films leaves out anything Documentaries already shows. The
 * tags are untouched; only the page's presentation dedupes.
 *
 * An empty section means nothing has been tagged into it yet — a curation
 * state, not a missing feature — and the page leaves it out.
 */
export async function listGiveGetGo(): Promise<GiveGetGoShelf[]> {
  const shelves = await Promise.all(
    GIVE_GET_GO_SECTIONS.map(async (section) => ({
      ...section,
      items: await listCatalogueByTag(section.tag),
    })),
  );

  const documentaries = new Set(
    shelves.find((s) => s.slug === "documentaries")?.items.map((i) => i.id),
  );
  return shelves.map((shelf) =>
    shelf.slug === "films"
      ? { ...shelf, items: shelf.items.filter((i) => !documentaries.has(i.id)) }
      : shelf,
  );
}

/**
 * The Give-Get-Go Education CIC website.
 *
 * A RELATED VENTURE with its own platform (note 11) — never proxied, embedded
 * or absorbed into the Academy or Admin. Held here so the destination is
 * declared once.
 */
export const GIVE_GET_GO_EDUCATION_URL = "https://give-get-go.com";
