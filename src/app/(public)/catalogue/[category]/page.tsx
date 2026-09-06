import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WorkCard } from "@/components/content/WorkCard";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CATALOGUE_CATEGORIES,
  categoryLabel,
  isCatalogueCategory,
  listCatalogue,
} from "@/lib/content/catalogue";

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

export default async function CatalogueCategoryPage({
  params,
}: PageProps<"/catalogue/[category]">) {
  const { category } = await params;

  // An unknown category is a missing page, not an empty list.
  if (!isCatalogueCategory(category)) notFound();

  const items = await listCatalogue(category);

  return (
    <Section>
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link href="/catalogue" className="hover:text-foreground">
            Catalogue
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">{categoryLabel(category)}</span>
        </nav>

        <PageHeader
          eyebrow="Catalogue"
          title={categoryLabel(category)}
          description={BLURB[category]}
        />

        {items.length === 0 ? (
          <EmptyState
            title="Nothing published here yet"
            description="This part of the catalogue is still being prepared."
          />
        ) : (
          <>
            {/*
              A GRID OF COVERS, not a divided list. The previous treatment was a
              `divide-y` stack with the artwork squeezed inside each row, which
              is what made every listing on the site read the same way whatever
              it contained. The work here is visual, so the artwork leads.
            */}
            <ul className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {items.map((item, i) => (
                <Reveal
                  as="li"
                  key={item.id}
                  // Stagger across the row, not the whole list: a 40-item grid
                  // multiplying the index would delay the last card by seconds.
                  delay={(i % 4) * 60}
                  className="h-full"
                >
                  <WorkCard item={item} priority={i < 4} />
                </Reveal>
              ))}
            </ul>

            <p className="mt-10 text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "entry" : "entries"}
            </p>
          </>
        )}
      </Container>
    </Section>
  );
}
