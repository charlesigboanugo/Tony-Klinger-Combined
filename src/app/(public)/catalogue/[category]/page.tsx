import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PosterFan, ScreeningHero } from "@/components/catalogue/ScreeningHero";
import { WorkWall } from "@/components/catalogue/WorkWall";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CATALOGUE_CATEGORIES,
  categoryLabel,
  fanFillers,
  isCatalogueCategory,
  listCatalogue,
} from "@/lib/content/catalogue";
import { cn } from "@/lib/utils/cn";

/**
 * A validated dynamic segment rather than seven near-identical folders.
 * Note 03 §7 permits either; the URLs are identical.
 */
export function generateStaticParams() {
  return CATALOGUE_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/catalogue/[category]">): Promise<Metadata> {
  const { category } = await params;
  return { title: categoryLabel(category) };
}

/** Copy that says what a category actually contains, rather than repeating its name. */
const BLURB: Record<string, string> = {
  books:
    "Novels, memoir and the working manuals — six decades of writing about, and from inside, the film business.",
  films:
    "Features and documentaries produced, directed or written across a career that ran from The Who to Get Carter.",
  audio: "Recordings, readings and audiobook editions.",
  interviews: "Conversations, on the record.",
  "stories-from-the-front-line":
    "Short pieces from people who were there — the industry as it was actually experienced.",
  podcasts: "Series and appearances, in full.",
  watch: "Film and video to watch now.",
};

/**
 * One collection of the catalogue — note 03 §7, note 10 §42.
 *
 * Two movements: the centred premiere stage (`ScreeningHero`), lit by this
 * collection's own covers, with its posters dealt into a fan beneath the title
 * and hanging into the page; then the WALL — every work as a bare poster, or as a two-column still
 * when its artwork is landscape.
 *
 * No numbers or counts (owner, 2026-09-25), and no separate "spotlight": it
 * was a poster-beside-text split that repeated the first poster of the fan
 * directly above it.
 */
export default async function CatalogueCategoryPage({
  params,
}: PageProps<"/catalogue/[category]">) {
  const { category } = await params;

  // An unknown category is a missing page, not an empty list.
  if (!isCatalogueCategory(category)) notFound();

  const [items, all] = await Promise.all([listCatalogue(category), listCatalogue()]);
  const label = categoryLabel(category);

  // The fan leads with the collection's own covers; a collection with fewer
  // than three is filled from other pictures of those same works, as on the
  // hub's cards (`fanFillers`).
  const covers = items.filter((item) => item.storage_path).map((item) => item.storage_path!);
  const fan = [...covers, ...(await fanFillers(items, all))];
  // A lone cover with two fillers: the second filler — furthest from the
  // cover — takes the middle, as on the hub card, so two editions sharing
  // artwork never sit side by side (owner, 2026-09-26).
  const dealt = covers.length === 1 && fan.length === 3 ? [fan[0], fan[2], fan[1]] : fan;

  return (
    <>
      <ScreeningHero
        eyebrow={
          <Link href="/catalogue" className="hover:text-secondary-foreground">
            Catalogue
          </Link>
        }
        title={label}
        lede={BLURB[category]}
        backdrop={fan}
        stage={dealt.length > 0 ? <PosterFan paths={dealt} /> : undefined}
      />

      {/* `overflow-x-clip`: each poster's hover glow is deliberately larger
          than its artwork, and on a narrow screen a
          tile at the edge pushed its glow past it — a few pixels of sideways
          scroll between 416px and 750px. `clip`, not `hidden`, so this does
          not become a scroll container. */}
      <section className={cn("overflow-x-clip pb-16 sm:pb-24", dealt.length > 0 ? "pt-8 sm:pt-12" : "pt-16 sm:pt-24")}>
        <Container width="wide">
          {items.length === 0 ? (
            <EmptyState
              title="Nothing published here yet"
              description="This part of the catalogue is still being prepared."
            />
          ) : (
            <WorkWall items={items} />
          )}
        </Container>
      </section>
    </>
  );
}
