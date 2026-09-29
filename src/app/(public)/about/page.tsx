import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

import { WorkLink } from "@/components/content/WorkLink";
import { Band } from "@/components/layout/Band";
import { Container } from "@/components/layout/Container";
import { DesignPhoto, PhotoMosaic } from "@/components/media/DesignPhoto";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { COVER_FOCUS_CLASS, listCatalogue, type CatalogueItem } from "@/lib/content/catalogue";
import { listTestimonials } from "@/lib/content/testimonials";
import { designPhotos } from "@/lib/site/design-photos";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "About",
  description:
    "Tony Klinger — producer, director, author and educator, with six decades in film, television and music.",
};

const eyebrow = "text-xs font-semibold tracking-[0.2em] uppercase";

/**
 * Left padding for a full-bleed half that must line up with the content
 * column: the Container's gutter, plus half of whatever the viewport has
 * beyond the column's 76rem from lg.
 */
const inset = "px-4 sm:px-6 lg:pr-0 lg:pl-[max(2rem,calc((100vw-76rem)/2+2rem))]";

/**
 * THE STORY IN CHAPTERS. Every sentence is the real biography, taken from the
 * coaching app's own About page and, since 2026-09-26, the About and
 * biography pages of the old main site and coaching site (the crew ladder,
 * the credits list, the further names, the writing beyond the books) —
 * only regrouped by period, so a reader can find a decade instead of reading
 * one long column. `works` names catalogue
 * titles: each chapter shows the covers of the works it mentions, linked to
 * their pages, and quietly shows none when a title has no cover.
 */
const chapters: {
  id: string;
  era: string;
  title: string;
  lead: ReactNode;
  body?: ReactNode;
  works?: string[];
  /** One figure the chapter's own text states — never a new claim. */
  stat: { figure: string; label: string };
  /** The people named in the text, set as a wall of names. */
  names?: string[];
  /** A design photo placed in the chapter, by its `designPhotos` key. */
  photo?: "aboutTalk";
}[] = [
  {
    id: "the-start",
    era: "1960s",
    title: "The start",
    stat: { figure: "21", label: "the age by which he held senior responsibilities" },
    lead: (
      <>
        Tony began in the mid-1960s as an assistant director on{" "}
        <em>The Avengers</em>, and had taken on senior responsibilities before
        he turned 21.
      </>
    ),
    body: (
      <>
        By eighteen he was making award-winning films that received wide
        public distribution. He worked his way up the crew ladder on films
        including <em>Up the Junction</em> and <em>Get Carter</em>, with
        assistant director credits on <em>The Penthouse</em> and{" "}
        <em>Up the Junction</em>.
      </>
    ),
  },
  {
    id: "music-and-pictures",
    era: "1970s",
    title: "Music and the big pictures",
    stat: { figure: "30+", label: "countries produced in" },
    names: [
      "Jack Nicholson",
      "Peter Ustinov",
      "Lee Marvin",
      "Sir John Gielgud",
      "Roger Moore",
      "Michael Caine",
      "Peter Finch",
      "Susannah York",
      "Peter Fonda",
      "Shelley Winters",
      "Omar Sharif",
      "Mickey Rooney",
      "Elmer Bernstein",
      "Maurice Jarre",
      "Henry Mancini",
      "James Galway",
      "Deep Purple",
      "Supertramp",
      "The Who",
    ],
    lead: (
      <>
        His work includes <em>The Kids Are Alright</em> with The Who,{" "}
        <em>Extremes</em>, <em>Deep Purple Rises Over Japan</em> and{" "}
        <em>The Butterfly Ball</em>, and collaborations with his father, the
        producer Michael Klinger, on <em>Gold</em> and{" "}
        <em>Shout at the Devil</em>.
      </>
    ),
    body: (
      <>
        He was assistant producer on <em>Gold</em>, associate producer on{" "}
        <em>Shout at the Devil</em> and <em>Rachel&apos;s Man</em>, and London
        producer on <em>Barcelona Kill</em>; he directed{" "}
        <em>One of the Boys</em>, wrote and directed <em>Promo Man</em>, and
        in 1981 produced <em>Riding High</em> alongside his father. The music
        films ran on to <em>Galway Plays Mancini</em>. Along the way he worked
        with the names below, among others, and has produced across more than
        thirty countries.
      </>
    ),
    works: [
      "The Kids Are Alright",
      "Deep Purple Rises Over Japan",
      "The Butterfly Ball",
      "Gold",
      "Shout at the Devil",
      "Riding High",
    ],
  },
  {
    id: "full-circle",
    era: "2008 – 2023",
    title: "Full circle",
    stat: { figure: "50", label: "years of Get Carter, marked in 2023" },
    lead: (
      <>
        More recently he premiered <em>Full Circle</em> (2008) and{" "}
        <em>The Man Who Got Carter</em> (2018), a tribute to his father
        featuring Sir Michael Caine and Mike Hodges.
      </>
    ),
    body: (
      <>
        He co-produced and directed <em>Solo2Darwin</em> (2021) and
        executive-produced <em>Sisters</em>, following the Afghan all-female
        orchestra Zohra. In 2023 he presented{" "}
        <em>Dirty, Sexy and Totally Iconic</em>, marking fifty years of{" "}
        <em>Get Carter</em>.
      </>
    ),
    works: [
      "Full Circle",
      "The Man Who Got Carter",
      "Solo2Darwin",
      "Sisters",
      "Dirty, Sexy & Totally Iconic",
    ],
  },
  {
    id: "on-the-page",
    era: "The books",
    title: "On the page",
    stat: { figure: "6", label: "books, from memoir to how-to" },
    lead: (
      <>
        He is the author of <em>Who Knows</em> (previously{" "}
        <em>Twilight of the Gods</em> and <em>The Who and I</em>),{" "}
        <em>Under God&apos;s Table</em>, <em>The Butterfly Boy</em>,{" "}
        <em>Alsatia: The Search for Treasure</em> and two books on getting into
        and getting made in the movie business.
      </>
    ),
    body: (
      <>
        Alongside the books: articles, columns, blogs, podcasts, film scripts
        and two plays. He is also an acclaimed public speaker.
      </>
    ),
    works: [
      "Who Knows: The Making of a Rock Movie",
      "Under God's Table",
      "The Butterfly Boy",
      "Alsatia, the Search for Treasure",
      "How to Get Into the Movie Business",
      "How to Get Your Movie Made, by Someone Who Knows",
    ],
  },
  {
    id: "passing-it-on",
    era: "2016 – now",
    title: "Passing it on",
    stat: { figure: "2019", label: "coaching directly since" },
    photo: "aboutTalk",
    lead: (
      <>
        In 2016 he founded Give-Get-Go, a community outreach project opening up
        filmmaking to people who would not otherwise get near it, and in 2019
        began coaching directly — which is what this site exists for.
      </>
    ),
  },
];

/**
 * Columns for a chapter's covers: every cover on one line from `sm`, and on
 * phones two even-ish lines — never one cover alone on the last line
 * (owner, 2026-09-25). Four and one go two across; the rest three.
 */
function coverGrid(count: number) {
  const phone = count % 3 === 1 ? "grid-cols-2" : "grid-cols-3";
  const wide = {
    1: "sm:grid-cols-4",
    2: "sm:grid-cols-4",
    3: "sm:grid-cols-4",
    4: "sm:grid-cols-4",
    5: "sm:grid-cols-5",
    6: "sm:grid-cols-6",
  }[Math.min(count, 6)];
  return cn(phone, wide);
}

/** The two honours, each drawn inside a laurel. */
const awards = [
  { title: "Lifetime Achievement Award", from: "Romford Film Festival", year: "2018" },
  { title: "The Queen's Anniversary Award", from: "for Education", year: null },
];

/** Set as end credits: the post, then where. */
const posts = [
  { role: "National Secretary", name: "Association of Media Practice Educators" },
  { role: "Co-founder", name: "Screen Commission Northants" },
  {
    role: "Lecturer and programme leader, to Masters level",
    name: "Bournemouth Film School · Northern Film School · University of East London",
  },
  { role: "Founder", name: "Give-Get-Go, 2016" },
];

/**
 * A laurel wreath: two mirrored branches of leaves around an open centre.
 * Leaves are placed along an arc and turned to follow it, so the wreath is
 * drawn rather than shipped as an image, and takes `currentColor`.
 */
function Laurel({ className }: { className?: string }) {
  // One branch up the left side: a stem arc from the foot (262°) to the upper
  // left (138°), with pointed leaves in two alternating rows — outer and
  // inner — each turned to follow the arc (180° − θ) and splayed away from
  // the stem, shrinking towards the tip. The right branch is its mirror.
  const r = 84;
  const at = (deg: number, rr = r) => {
    const rad = (deg * Math.PI) / 180;
    return { x: +(100 + rr * Math.cos(rad)).toFixed(1), y: +(100 - rr * Math.sin(rad)).toFixed(1) };
  };
  const leaves = Array.from({ length: 12 }, (_, i) => {
    const theta = 258 - i * 10.5;
    const outer = i % 2 === 0;
    const p = at(theta, r + (outer ? 7 : -7));
    const scale = 1 - i * 0.04;
    const rot = 180 - theta + (outer ? -38 : 38);
    return { ...p, rot: +rot.toFixed(1), scale: +scale.toFixed(2) };
  });
  const foot = at(262);
  const tip = at(138);
  const branch = (
    <>
      <path
        d={`M${foot.x} ${foot.y} A ${r} ${r} 0 0 1 ${tip.x} ${tip.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {leaves.map((l, i) => (
        <path
          key={i}
          d="M0 -13 C 5.5 -6 5.5 6 0 13 C -5.5 6 -5.5 -6 0 -13 Z"
          transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.scale})`}
        />
      ))}
    </>
  );
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className} fill="currentColor">
      <g>{branch}</g>
      <g transform="translate(200 0) scale(-1 1)">{branch}</g>
    </svg>
  );
}

/**
 * About — note 03 §8, note 10 §42.3.
 *
 * Set as an editorial feature rather than a column of prose (owner,
 * 2026-09-24): a split title card, the biography in five chapters with a
 * sticky rail and each chapter's own covers, the honours as end credits, the
 * contact sheet, and one voice to close. The copy is the real biography; the
 * covers are rows already in the catalogue.
 */
export default async function AboutPage() {
  const [works, featured] = await Promise.all([
    listCatalogue(),
    listTestimonials({ featuredOnly: true }),
  ]);
  // The closing voice: a signed quote of a sentence or two, not a paragraph
  // (owner, 2026-09-26: the 290-character one set too heavily at quote
  // size). The fullest one within 200 characters.
  const voice = featured
    .filter((t) => t.attributed_to && t.quote.length <= 200)
    .sort((a, b) => b.quote.length - a.quote.length)[0];

  const byTitle = new Map<string, CatalogueItem>(works.map((w) => [w.title, w]));
  const coversFor = (titles: string[] = []) =>
    titles
      .map((t) => byTitle.get(t))
      .filter((w): w is CatalogueItem => Boolean(w?.storage_path));

  return (
    <>
      {/*
        TITLE CARD — noir, with the portrait dissolved into the field rather
        than boxed beside it (owner, 2026-09-25). The photo fills the right
        three-fifths as an oval pool of light that fades out into noir, so the blue
        backdrop melts into noir; the words sit on the solid field, never over
        the photo, so they always read. On a phone the portrait leads at full
        width, fades out at its foot, and the words rise onto the fade.

        The chapters run across the foot as a timeline — a hairline, a red
        node per chapter, each a jump link — so the contents double as a
        preview of the story's arc.

        The words pad their inner edge to the content column (`inset`), so
        they line up with the timeline and the page below. Entrance motion is
        CSS keyframes (globals.css), off under reduced motion.
      */}
      <section className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground lg:flex lg:min-h-[calc(100svh-4.5rem)] lg:flex-col">
        <figure
          className={cn(
            "relative -z-10 aspect-4/5 w-full sm:aspect-4/3",
            "mask-[linear-gradient(to_bottom,black_45%,transparent_92%)]",
            "lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[60%]",
            // An oval pool of light around Tony rather than a straight fade:
            // the edge curves into noir, like a vignette. The linear fade at
            // the foot keeps the timeline on the solid field.
            "lg:mask-[radial-gradient(ellipse_80%_100%_at_68%_36%,black_42%,transparent_74%),linear-gradient(to_bottom,black_55%,transparent_82%)] lg:mask-intersect",
          )}
        >
          <div className="absolute inset-0 animate-[settle_2.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
            <Image
              src={designPhotos.aboutHero.src}
              alt={designPhotos.aboutHero.alt}
              fill
              priority
              fetchPriority="high"
              quality={90}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className={cn("object-cover", designPhotos.aboutHero.focus)}
            />
          </div>
        </figure>
        {/* Outside the figure: its mask would fade the credit away. */}
        <PhotoCredit src={designPhotos.aboutHero.src} variant="overlay" />

        <div className="-mt-16 sm:-mt-24 lg:mt-0 lg:flex lg:flex-1">
          <div className={cn(inset, "relative flex items-center pb-14 sm:pb-20 lg:w-[64%] lg:items-start lg:pt-(--hero-text-top) lg:pb-16 lg:pr-12")}>
            <div className="max-w-176">
              <p
                className={cn(
                  eyebrow,
                  "flex items-center gap-4 text-block-foreground/75",
                  "animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none",
                )}
                style={{ animationDelay: "150ms" }}
              >
                <span aria-hidden="true" className="h-px w-10 bg-primary" />
                Tony&apos;s story
              </p>
              {/* Clipped so the name rises into place, as on the home title
                  card; padding gives descenders room inside the clip. */}
              <h1 className="mt-5 overflow-hidden pb-[0.1em]">
                <span
                  className="block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
                  style={{ animationDelay: "250ms" }}
                >
                  Tony Klinger
                </span>
              </h1>
              <p
                className="mt-5 font-normal text-xl leading-snug text-balance animate-[fade-up_0.9s_var(--ease-out-expo)_both] max-w-133 sm:text-2xl lg:text-[1.625rem] lg:leading-[1.3] lg:text-pretty motion-reduce:animate-none"
                style={{ animationDelay: "500ms" }}
              >
                Producer, director, author and educator.{" "}
                <em className="text-block-foreground/75">
                  Six decades in film, television and music.
                </em>
              </p>
              <p
                className="mt-6 max-w-150 leading-relaxed text-block-foreground/80 text-pretty animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
                style={{ animationDelay: "650ms" }}
              >
                An award-winning career in the international film industry, from
                an assistant director&apos;s chair on <em>The Avengers</em> to a
                coaching programme for the people coming up behind him. More
                than a hundred films worldwide, six books, and a Masters-level
                teaching career along the way. He calls himself, simply, a
                storyteller.
              </p>
            </div>
          </div>
        </div>

        {/* THE CHAPTERS — a timeline across the foot of the title card. */}
        <nav
          aria-label="Chapters"
          className="animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
          style={{ animationDelay: "800ms" }}
        >
          <Container className="pb-14 lg:pt-10 lg:pb-12">
            <ol className="grid gap-y-1 border-l border-block-foreground/25 pl-6 lg:grid-cols-5 lg:gap-x-6 lg:border-t lg:border-l-0 lg:pt-6 lg:pl-0">
              {chapters.map((c, i) => (
                <li key={c.id} className="relative">
                  <a href={`#${c.id}`} className="group block py-2 lg:py-0 lg:pr-4">
                    {/* The node: on the left rule on phones, on the top rule
                        from lg. It grows on hover, and the title brightens. */}
                    <span
                      aria-hidden="true"
                      className="absolute top-[1.05rem] left-[-1.8rem] size-2.5 rounded-full bg-primary ring-4 ring-block-noir transition-transform duration-(--dur-base) ease-expo group-hover:scale-150 lg:top-[-1.85rem] lg:left-0"
                    />
                    <span className={cn(eyebrow, "block text-block-foreground/65")}>{c.era}</span>
                    <span className="mt-1.5 flex items-baseline gap-2.5">
                      <span className="text-sm text-block-foreground/60 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-medium text-lg leading-snug text-block-foreground/90 decoration-primary decoration-2 underline-offset-[6px] transition-colors group-hover:text-block-foreground group-hover:underline">
                        {c.title}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </Container>
        </nav>
      </section>

      {/*
        THE STORY — five chapters. A rail on the left holds each chapter's
        number, period and title and stays in view while its text scrolls;
        the words sit in a reading measure on the right, the lead sentence set
        large, then the covers of the works that chapter names.
      */}
      <section aria-labelledby="story-heading" className="py-24 sm:py-32 lg:py-36">
        <Container>
          <h2 id="story-heading" className="sr-only">The story</h2>
          <ol className="space-y-20 sm:space-y-24 lg:space-y-28">
            {chapters.map((c, i) => {
              const covers = coversFor(c.works);
              return (
                <li
                  key={c.id}
                  id={c.id}
                  className="grid scroll-mt-28 gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-24"
                >
                  {/* THE RAIL — a hairline that fills red as the chapter
                      scrolls past, beside a block that stays in view: the
                      numeral (fills as it arrives), the period, the title and
                      the one figure the chapter's text states. */}
                  <div className="chapter-rail hidden lg:block">
                    <div className="sticky top-28 pl-8">
                      <span aria-hidden="true" className="chapter-numeral block font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-none font-semibold tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Eyebrow className="mt-6">{c.era}</Eyebrow>
                      <h3 className="mt-2 font-display text-3xl leading-tight font-semibold">
                        {c.title}
                      </h3>
                      <p className="mt-8 border-t border-foreground/15 pt-5">
                        <span className="block font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-none font-semibold tabular-nums">
                          {c.stat.figure}
                        </span>
                        <span className="mt-2 block text-sm leading-snug text-muted-foreground">
                          {c.stat.label}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* The same rail, stacked, on phones and tablets. */}
                  <div className="lg:hidden">
                    <span aria-hidden="true" className="chapter-numeral block font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-none font-semibold tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Eyebrow className="mt-4">{c.era}</Eyebrow>
                    <h3 className="mt-2 font-display text-3xl leading-tight font-semibold">{c.title}</h3>
                  </div>

                  <div className="min-w-0 border-t border-foreground/15 pt-10 sm:pt-12">
                    <Reveal className="max-w-3xl">
                      <p className="font-normal text-xl leading-snug text-pretty sm:text-2xl lg:text-[1.625rem] lg:leading-[1.35]">
                        {c.lead}
                      </p>
                      {c.body ? (
                        <p className="mt-8 text-lg leading-relaxed text-muted-foreground text-pretty">
                          {c.body}
                        </p>
                      ) : null}
                      <p className="mt-8 flex items-baseline gap-3 lg:hidden">
                        <span className="font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-none font-semibold tabular-nums">{c.stat.figure}</span>
                        <span className="text-sm text-muted-foreground">{c.stat.label}</span>
                      </p>
                    </Reveal>

                    {/* THE NAMES — a wall, alternating roman and italic, so
                        the list reads as a billing, not a sentence. */}
                    {c.names ? (
                      <Reveal className="mt-16">
                        <p className="sr-only">Worked with: {c.names.join(", ")}.</p>
                        <p aria-hidden="true" className="text-lg leading-relaxed font-medium text-pretty sm:text-xl">
                          {c.names.map((n, k) => (
                            <span key={n}>
                              <span className={cn("whitespace-nowrap", k % 2 === 1 && "font-normal text-muted-foreground italic")}>{n}</span>
                              {/* The space after the dot is the line's only break
                                  point: each name itself never wraps. */}
                              {k < c.names!.length - 1 ? (
                                <>
                                  <span className="mx-2 align-middle text-primary">&middot;</span>{" "}
                                </>
                              ) : null}
                            </span>
                          ))}
                        </p>
                      </Reveal>
                    ) : null}

                    {c.photo ? (
                      <Reveal className="mt-16">
                        <DesignPhoto
                          image={designPhotos[c.photo]}
                          aspect="aspect-3/2"
                          sizes="(min-width: 1024px) 55vw, 100vw"
                        />
                      </Reveal>
                    ) : null}

                    {covers.length > 0 ? (
                      <ul className={cn("mt-16 grid gap-4 sm:gap-6", coverGrid(covers.length))}>
                        {covers.map((work, n) => (
                          <Reveal as="li" key={work.id} delay={n * 60}>
                            <WorkLink item={work} className="block" linkClassName="group block">
                              <span className="relative block aspect-2/3 overflow-hidden rounded-sm bg-surface-muted shadow-card transition-[translate,box-shadow] duration-(--dur-base) ease-expo group-hover:-translate-y-1 group-hover:shadow-lift motion-reduce:transform-none">
                                <StoredImage
                                  path={work.storage_path}
                                  alt=""
                                  fill
                                  sizes="(min-width: 1024px) 14vw, 30vw"
                                  className={COVER_FOCUS_CLASS[work.cover_focus]}
                                />
                              </span>
                              <span className="mt-3 block text-xs leading-snug text-muted-foreground transition-colors group-hover:text-accent">
                                {work.title}
                              </span>
                            </WorkLink>
                          </Reveal>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/*
        IN HIS OWN WORDS — Tony on what the work is for, verbatim from the old
        site's About page (owner, 2026-09-26: more content). On the page
        ground after the chapters, before the noir line: the one place the
        story is told in the first person. Set in the body face, left-aligned
        beside a rail, so it does not echo the centred client quote that
        closes the page.
      */}
      <section aria-labelledby="own-words-heading" className="pb-24 sm:pb-32">
        <Container>
          <div className="grid gap-8 border-t border-foreground/15 pt-16 sm:pt-20 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-24">
            <div className="lg:pl-8">
              <Eyebrow>In his own words</Eyebrow>
              <h2 id="own-words-heading" className="sr-only">In his own words</h2>
            </div>
            <Reveal as="figure" className="max-w-3xl">
              <blockquote className="space-y-6 text-pretty">
                <p className="font-medium text-2xl leading-snug sm:text-[1.875rem] sm:leading-[1.3]">
                  <span aria-hidden="true" className="mr-1 text-primary">&ldquo;</span>
                  Above all I love telling stories, writing books and
                  screenplays, making films, talking and teaching about films,
                  in fact anything to do with film.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  Writing books and screenplays and making documentaries are the
                  spine of my life&apos;s work, and this field is, for me, always
                  fascinating and compelling. Incredible stories about special
                  people and incidents resonate around our world, and I am
                  honoured to be a small part of those lives, sharing their
                  stories to an increasingly receptive world.&rdquo;
                </p>
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3 text-sm">
                <span aria-hidden="true" className="h-px w-8 bg-primary" />
                <span className="font-semibold">Tony Klinger</span>
              </figcaption>
            </Reveal>
          </div>
        </Container>
      </section>

      {/*
        THE LINE — the black-and-white portrait anchored right at nearly its
        whole frame, dissolving into noir, with the one line beside it. A
        full-bleed banner cropped this wide frame to Tony's head (owner,
        2026-09-25), so this sets the photo in the right two-thirds instead.
        On a phone it leads in a portrait crop centred on him.
      */}
      <section className="relative isolate overflow-hidden bg-block-noir text-block-foreground">
        <figure
          className={cn(
            "relative aspect-4/5 w-full sm:aspect-4/3",
            "mask-[linear-gradient(to_bottom,black_70%,transparent)]",
            "lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[68%]",
            "lg:mask-[linear-gradient(to_right,transparent,black_35%),linear-gradient(to_bottom,black_80%,transparent)] lg:mask-intersect",
          )}
        >
          <Image
            src={designPhotos.aboutBanner.src}
            alt={designPhotos.aboutBanner.alt}
            fill
            quality={90}
            sizes="(min-width: 1024px) 68vw, 100vw"
            className={cn("object-cover", designPhotos.aboutBanner.focus)}
          />
        </figure>
        <Container className="relative -mt-24 pb-24 sm:-mt-32 sm:pb-32 lg:mt-0 lg:flex lg:min-h-[85svh] lg:items-center lg:py-40">
          <Reveal className="max-w-lg xl:max-w-xl">
            <span aria-hidden="true" className="block h-px w-10 bg-primary" />
            <p className="mt-8 font-display text-2xl leading-tight font-semibold text-balance sm:text-(length:--text-h2)">
              From assistant director on <em>The Avengers</em> to{" "}
              <em>The Man Who Got Carter</em>, half a century later.
            </p>
          </Reveal>
        </Container>
        <PhotoCredit src={designPhotos.aboutBanner.src} variant="overlay" />
      </section>

      {/*
        RECOGNITION — the two honours as laurelled medallions, then the posts
        set as a film's end credits: the role right-aligned, the name
        left-aligned, meeting at a centre line.
      */}
      <Band tone="noir" spacing="balanced">
        <div className="text-center">
          <p className={cn(eyebrow, "text-block-foreground/70")}>Recognition</p>
          <h2 className="mt-5 font-display">Honours and posts</h2>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-block-foreground/75">
            Alongside the work itself: the awards, the lecture theatres and the
            professional bodies.
          </p>
        </div>

        <ul className="mx-auto mt-12 grid max-w-4xl gap-12 sm:grid-cols-2 sm:gap-8">
          {awards.map((a, i) => (
            <Reveal as="li" key={a.title} delay={i * 120} className="text-center">
              <div className="relative mx-auto grid aspect-square w-64 place-items-center sm:w-72">
                <Laurel className="absolute inset-0 h-full w-full text-block-foreground/55" />
                <div className="relative max-w-40 px-2">
                  {a.year ? (
                    <p className="text-sm tracking-[0.2em] text-block-foreground/70 tabular-nums">{a.year}</p>
                  ) : null}
                  <p className="mt-1 font-display text-xl leading-tight font-semibold text-balance">{a.title}</p>
                </div>
              </div>
              <p className="mt-4 text-[0.6875rem] font-semibold tracking-[0.18em] text-block-foreground/65 uppercase">
                {a.from}
              </p>
            </Reveal>
          ))}
        </ul>

        <dl className="mx-auto mt-20 max-w-4xl divide-y divide-block-foreground/15 border-y border-block-foreground/15">
          {posts.map((r, i) => (
            <Reveal
              key={r.role}
              delay={i * 50}
              className="grid gap-1 py-5 text-center sm:grid-cols-2 sm:gap-10 sm:text-left"
            >
              <dt className="text-[0.6875rem] font-semibold tracking-[0.18em] text-block-foreground/65 uppercase sm:pt-1.5 sm:text-right">
                {r.role}
              </dt>
              <dd className="font-medium text-xl leading-snug sm:text-2xl">{r.name}</dd>
            </Reveal>
          ))}
        </dl>
      </Band>

      {/* CONTACT SHEET — the portrait session, one lead frame and four tiles. */}
      <section aria-labelledby="sheet-heading" className="py-24 sm:py-32">
        <Container width="wide">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Contact sheet</Eyebrow>
              <h2 id="sheet-heading" className="mt-4 font-display">
                In front of the camera, for once.
              </h2>
            </div>
          </div>
          <PhotoMosaic images={designPhotos.aboutMosaic} />
        </Container>
      </section>

      {/*
        ONE VOICE TO CLOSE — open on the page ground, no card (owner,
        2026-09-25): a hairline above parts it from the contact sheet, and the
        ground below keeps it reading as part of the page, not the start of
        the footer, which a full-bleed paper field did. The
        first featured testimonial, then the ways forward below it, all
        centred (owner, 2026-09-25). Without a featured quote, only they show.
      */}
      <section className="pb-28 sm:pb-40">
        <Container>
          <div className="border-t border-border pt-16 text-center sm:pt-24">
            {voice ? (
              <Reveal as="figure" className="mx-auto max-w-4xl">
                <span aria-hidden="true" className="block font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-[0.6] text-primary">
                  &ldquo;
                </span>
                {/* The page's pull quote, a size below the testimonials lead
                    quote (owner, 2026-09-26: at the h2 size it ran to eight
                    lines). Body face: testimonials never use the display
                    serif (owner, same day). */}
                <blockquote className="mt-4 text-2xl leading-[1.35] font-medium text-balance sm:text-[1.875rem]">
                  {voice.quote}
                </blockquote>
                {voice.attributed_to || voice.attribution_detail ? (
                  <figcaption className="mt-8 text-sm text-muted-foreground">
                    <span>
                      {voice.attributed_to ? (
                        <span className="font-semibold text-foreground">{voice.attributed_to}</span>
                      ) : null}
                      {voice.attributed_to && voice.attribution_detail ? " · " : null}
                      {voice.attribution_detail}
                    </span>
                  </figcaption>
                ) : null}
              </Reveal>
            ) : null}

            {/* No divider under the quote, and no catalogue aside (owner,
                2026-09-26): the quote hands straight on to the next step. */}
            <div className={cn("flex flex-col items-center gap-8", voice && "mt-20 sm:mt-24")}>
              <div>
                <Eyebrow align="center">What next</Eyebrow>
                <p className="mt-3 font-medium text-2xl leading-snug">
                  Six decades of craft, passed on.
                </p>
              </div>
              <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <ButtonLink href="/coaching" size="lg">
                  Work with Tony
                  <ButtonArrow />
                </ButtonLink>
                <ButtonLink href="/about/testimonials" size="lg" variant="outline">
                  Read every testimonial
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
