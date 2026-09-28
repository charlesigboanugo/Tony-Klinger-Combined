import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { PosterWall } from "@/components/catalogue/PosterWall";
import { Container } from "@/components/layout/Container";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import {
  CATALOGUE_CATEGORIES,
  COVER_FOCUS_CLASS,
  fanFillers,
  listCatalogue,
  type CatalogueItem,
} from "@/lib/content/catalogue";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Books, films, audio, interviews and more from six decades of Tony Klinger's work.",
};

/**
 * What each collection holds, in a sentence. A card that says only "Books"
 * tells a visitor nothing they could not guess from the menu.
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

const beat = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties;

/**
 * The catalogue hub, "All works" — note 03 §7, note 10 §42.
 *
 * Two movements:
 *
 *   1. the WALL — every poster in the catalogue drifting behind one centred
 *      title (`PosterWall`), the work itself as the opening image;
 *   2. COLLECTIONS — a card per collection, its own posters fanned inside,
 *      spreading on hover. Each collection's own page lists its works, so
 *      the hub does not repeat them (owner, 2026-09-25).
 *
 * It ends there. A photo banner linking to About used to follow; it was
 * removed (owner, 2026-09-25) as disconnected from the page and redundant
 * with the menu and footer, which both lead to About.
 *
 * No counts or numbers (owner, 2026-09-25). A collection with nothing
 * published yet still has its card (owner, the same day), marked "Coming
 * soon" and not linked — its page would be empty. It is not dimmed: a
 * greyed-out card reads as broken. It becomes a link the moment a work in it
 * is published.
 */
export default async function CataloguePage() {
  const items = await listCatalogue();

  const byCategory = new Map<string, CatalogueItem[]>();
  for (const item of items) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  }
  // Every collection, including those with nothing published yet (owner,
  // 2026-09-25) — those show as "Coming soon" and do not link. Audio, with the
  // thinnest fan, drops a row to trade places with Stories From The Front
  // Line (owner, 2026-09-26); the order is changed here only, not everywhere
  // the categories are listed.
  const hubOrder: string[] = ["books", "films", "stories-from-the-front-line", "interviews", "audio", "podcasts", "watch"];
  const collections = [...CATALOGUE_CATEGORIES].sort(
    (a, b) => hubOrder.indexOf(a.slug) - hubOrder.indexOf(b.slug),
  );

  // Pictures to fill a short fan (see CollectionCard), fetched only for the
  // collections that need them.
  const fillers = new Map(
    await Promise.all(
      collections.map(async (c) => [c.slug, await fanFillers(byCategory.get(c.slug) ?? [], items)] as const),
    ),
  );

  const posters = items
    .filter((item) => item.storage_path)
    .map((item) => ({ path: item.storage_path!, focus: item.cover_focus }));

  return (
    <>
      <PosterWall posters={posters}>
        <p
          className="flex items-center gap-4 text-xs font-semibold tracking-[0.32em] text-block-foreground/75 uppercase animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
          style={beat(80)}
        >
          <span aria-hidden="true" className="h-px w-10 bg-block-foreground/50" />
          Catalogue
          <span aria-hidden="true" className="h-px w-10 bg-block-foreground/50" />
        </p>

        <h1 className="mt-6 overflow-hidden pb-[0.1em]">
          <span
            className="block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={beat(160)}
          >
            The <em className="font-normal italic">work</em>
          </span>
        </h1>

        <p
          className="measure mt-7 text-lg leading-relaxed text-block-foreground/80 text-pretty animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none sm:text-xl"
          style={beat(420)}
        >
          Films produced and directed, books written, and the stories from the
          front line — six decades of the work itself.
        </p>

        <div
          className="mt-10 flex flex-wrap justify-center gap-3 animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
          style={beat(540)}
        >
          <ButtonLink href="#collections" size="lg">
            Explore the collections
            <ButtonArrow />
          </ButtonLink>
        </div>
      </PosterWall>

      {/* ------------------------------------------------ in Tony's words */}
      {/* The old site's /catalogue introduction, in Tony's own words
          (restored 2026-09-26). Set as a quiet centred note — a label, a lede,
          two paragraphs at reading width — so it introduces the collections
          without becoming a section of its own. */}
      <section aria-labelledby="about-the-work" className="pt-20 sm:pt-28">
        <Container width="narrow" className="text-center">
          <Reveal>
            <Eyebrow id="about-the-work" align="center">Learn about my work</Eyebrow>
            <p className="mt-5 font-normal text-2xl leading-snug text-balance sm:text-[1.75rem]">
              As both a producer and a writer I have had a diverse background of work in
              many formats. Here you can learn about past, present and upcoming projects.
            </p>
          </Reveal>
          <Reveal delay={80} className="measure mx-auto mt-8 space-y-5 text-left text-[1.0625rem] leading-[1.8] text-foreground/85 sm:text-center">
            <p className="text-pretty">
              For most of my professional life, I never attended premiere presentations or film
              industry parties. I was not good at faking sincerity! Maybe this is also the result
              of being the son of a famous father who dominated a room with his hearty humour and
              story-telling. But time has passed and I, too, now deliver talks and lectures all
              over the world.
            </p>
            <p className="text-pretty">
              I endeavour to share my films, books, and plays with as many people as I can reach.
              This ‘late flowering’ stemmed from my years as a university academic when the
              enthusiasm and passion of my students planted a seed in me. I am busier than ever
              with new books, plays, and several films being created. I am also hugely proud to
              be the founder and Chief Executive of Give-Get-Go (or GGG!); a new project providing
              film-making opportunities for everyone.
            </p>
            <p className="pt-2 text-lg italic sm:text-center">— Tony Klinger</p>
          </Reveal>
        </Container>
      </section>

      {/* ------------------------------------------------ collections */}
      <section id="collections" aria-labelledby="collections-heading" className="scroll-mt-20 py-20 sm:py-28">
        <Container width="wide">
          <SectionHead id="collections-heading" eyebrow="Browse by collection" title="Collections" />

          {/* Two columns; an odd one out at the end takes the whole row, so
              the grid never ends on a hole. */}
          <ul className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {collections.map((category, i) => (
              <Reveal
                as="li"
                key={category.slug}
                delay={(i % 2) * 80}
                className={cn(
                  "h-full",
                  i === collections.length - 1 && collections.length % 2 === 1 && "sm:col-span-2",
                )}
              >
                <CollectionCard
                  slug={category.slug}
                  label={category.label}
                  works={byCategory.get(category.slug) ?? []}
                  fillers={fillers.get(category.slug) ?? []}
                />
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

    </>
  );
}

function SectionHead({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="mb-12 text-center">
      <Eyebrow align="center">{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 font-display">
        {title}
      </h2>
    </div>
  );
}

/**
 * A collection as a card: its first works fanned across the top, turned like
 * cards in a hand and spreading on hover, over a glow of their own colour. A
 * work with no artwork stands in the fan as a cover drawn from its title, and
 * a collection with no works yet shows one cover drawn from its own name — so
 * every collection card has the same anatomy.
 */
function CollectionCard({
  slug,
  label,
  works,
  fillers,
}: {
  slug: string;
  label: string;
  works: CatalogueItem[];
  fillers: string[];
}) {
  // Works with artwork first; the fan only falls back to drawn covers when a
  // collection has too few pictures to fill it.
  const fan = [...works.filter((w) => w.storage_path), ...works.filter((w) => !w.storage_path)].slice(0, 3);
  const glow = fan.find((w) => w.storage_path)?.storage_path ?? null;
  // Spread outward from the middle: left card left, right card right.
  const spread = [
    "-rotate-8 group-hover:-translate-x-10 group-hover:-rotate-12",
    "z-10 -translate-y-2 group-hover:-translate-y-5",
    "rotate-8 group-hover:translate-x-10 group-hover:rotate-12",
  ];
  // Every fan is three cards, so a collection with one or two works (or none
  // yet) sits in step with its neighbours instead of standing alone. The
  // empty places take other pictures of those same works (`fanFillers`), and
  // only then plain, uncoloured sleeves.
  const lead: ({ key: string; cover: ReactNode } | null)[] = fan.map((work) => ({
    key: work.id,
    cover: work.storage_path ? (
      <StoredImage path={work.storage_path} alt="" fill sizes="160px" className={COVER_FOCUS_CLASS[work.cover_focus]} />
    ) : (
      <GeneratedCover title={work.title} seed={work.slug} className="h-full p-4" />
    ),
  }));
  if (lead.length === 0) {
    lead.push({ key: slug, cover: <GeneratedCover title={label} seed={slug} className="h-full p-4" /> });
  }
  const extra = fillers.map((path) => ({
    key: path,
    cover: <StoredImage path={path} alt="" fill sizes="160px" />,
  }));
  // With two fillers, a lone work moves to the side and the second filler —
  // the furthest from its own cover — takes the middle, so two editions with
  // the same artwork never sit side by side (owner, 2026-09-26: Audio's
  // yellow Butterfly Boy jacket in the middle).
  const slots =
    lead.length === 1
      ? extra.length >= 2
        ? [lead[0], extra[1], extra[0]]
        : [extra[0] ?? null, lead[0], null]
      : lead.length === 2
        ? [lead[0], lead[1], extra[0] ?? null]
        : lead;
  const live = works.length > 0;

  const surface =
    "group relative isolate flex h-full min-h-104 flex-col overflow-hidden rounded-(--radius-lg) bg-block-noir text-block-foreground shadow-card sm:min-h-120";

  const content = (
    <>
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-40">
        {glow ? (
          <StoredImage path={glow} alt="" fill sizes="64px" className="scale-150 blur-[96px]" />
        ) : (
          <GeneratedCover title="" seed={slug} showTitle={false} className="h-full blur-2xl" />
        )}
      </div>

      <div aria-hidden="true" className="relative flex h-60 items-end justify-center pt-10 sm:h-72">
        {slots.map((slot, i) => (
          <div
            key={slot?.key ?? `sleeve-${i}`}
            className={cn(
              "relative -mx-5 aspect-3/4 w-32 shrink-0 origin-bottom overflow-hidden rounded-sm shadow-2xl ring-1 ring-white/10 sm:w-40",
              "transition-transform duration-(--dur-slow) ease-expo motion-reduce:transition-none",
              spread[i],
            )}
          >
            {slot ? (
              slot.cover
            ) : (
              <div className="h-full bg-linear-to-br from-white/14 to-white/4 backdrop-blur-sm" />
            )}
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-block-noir via-block-noir/60 to-transparent" />

      <div className="mt-auto p-7 text-center sm:p-9">
        <h3 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
          {label}
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-base text-block-foreground/75 text-pretty">
          {BLURB[slug]}
        </p>
        {live ? (
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
            Explore the collection
            <span
              aria-hidden="true"
              className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transition-none"
            >
              <ButtonArrow />
            </span>
          </p>
        ) : (
          <p className="mt-6 inline-flex rounded-full border border-block-foreground/30 px-4 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase">
            Coming soon
          </p>
        )}
      </div>
    </>
  );

  return live ? (
    <Link
      href={`/catalogue/${slug}`}
      className={cn(
        surface,
        "outline-offset-4 transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-1 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transform-none motion-reduce:transition-none",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={surface}>{content}</div>
  );
}
