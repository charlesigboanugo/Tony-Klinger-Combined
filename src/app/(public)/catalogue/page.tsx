import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { CATALOGUE_CATEGORIES, catalogueCounts } from "@/lib/content/catalogue";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Books, films, audio, interviews and more from six decades of Tony Klinger's work.",
};

/**
 * What each category holds, in a sentence. A tile that says only "Books" and a
 * number tells a visitor nothing they could not guess from the menu.
 */
const BLURB: Record<string, string> = {
  books: "Novels, memoir and the working manuals.",
  films: "Features and documentaries, from The Who to Get Carter.",
  audio: "Recordings, readings and audiobook editions.",
  interviews: "Conversations, on the record.",
  "stories-from-the-front-line": "The industry as it was actually experienced.",
  podcasts: "Series and appearances, in full.",
  watch: "Film and video to watch now.",
};

/**
 * Tones cycle through the three jewel fields.
 *
 * Indexed by POSITION rather than assigned per category, so adding a category
 * later cannot land two identical colours side by side and does not require
 * anyone to remember which category "owns" which colour.
 */
const TONES = ["oxblood", "teal", "indigo"] as const;
const TONE_CLASS = {
  oxblood: "bg-block-oxblood",
  teal: "bg-block-teal",
  indigo: "bg-block-indigo",
} as const;

export default async function CataloguePage() {
  const counts = await catalogueCounts();

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="The work"
          title="Catalogue"
          description="Six decades of films, books, recordings and conversations — the work itself, rather than a description of it."
        />

        {/*
          Colour fields rather than bordered cards on one background. Each
          category is a solid jewel block, which is what makes the hub scannable
          by hue instead of by reading seven near-identical labels.
        */}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOGUE_CATEGORIES.map((category, i) => {
            const count = counts[category.slug] ?? 0;
            const tone = TONES[i % TONES.length];

            return (
              <Reveal
                as="li"
                key={category.slug}
                delay={(i % 3) * 70}
                // The last tile spans two columns on the widest layout so the
                // grid does not end on a lonely orphan; seven items into three
                // columns otherwise leaves one stranded.
                className={cn(i === CATALOGUE_CATEGORIES.length - 1 && "lg:col-span-2")}
              >
                <Link
                  href={`/catalogue/${category.slug}`}
                  className={cn(
                    "group grain relative isolate flex h-full min-h-44 flex-col justify-between overflow-hidden rounded-(--radius-lg) p-6",
                    "text-block-foreground shadow-card transition-[transform,box-shadow] duration-(--dur-base) ease-expo",
                    "hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none",
                    TONE_CLASS[tone],
                  )}
                >
                  <div className="relative z-10">
                    <h2 className="font-display text-2xl leading-tight font-semibold">
                      {category.label}
                    </h2>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-block-foreground/80">
                      {BLURB[category.slug]}
                    </p>
                  </div>

                  <p className="relative z-10 mt-6 flex items-center gap-2 text-sm font-medium">
                    <span className="tabular-nums">
                      {count === 0
                        ? "Nothing published yet"
                        : `${count} ${count === 1 ? "entry" : "entries"}`}
                    </span>
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
                    >
                      &rarr;
                    </span>
                  </p>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
