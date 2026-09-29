import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { WorkCard } from "@/components/content/WorkCard";
import { PhotoSplit } from "@/components/media/DesignPhoto";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { Band } from "@/components/layout/Band";
import { Container } from "@/components/layout/Container";
import { Carousel } from "@/components/motion/Carousel";
import { LoopingStrip } from "@/components/motion/LoopingStrip";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { formatPrice } from "@/lib/commerce/pricing";
import {
  CATALOGUE_CATEGORIES,
  listCatalogue,
  workHref,
  type CatalogueItem,
} from "@/lib/content/catalogue";
import {
  listCohorts,
  listCoachingServices,
  listCourses,
  listMembershipTiers,
  type ProductPrice,
} from "@/lib/content/coaching";
import { listTestimonials } from "@/lib/content/testimonials";
import { designPhotos } from "@/lib/site/design-photos";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Tony Klinger — Film producer, author and coach",
  description:
    "Six decades in film and television. Courses, coaching, cohorts and retreats for filmmakers, writers and producers.",
};

/** The headline, one entry per line — three lines (owner, 2026-09-24) — so
 *  each can rise on its own beat. The first line runs long over the photo's
 *  plain black top; Tony's head sits clear of it at every desktop width. */
const headline: { text: string; italic?: boolean }[] = [
  { text: "Six decades in film," },
  { text: "put to work", italic: true },
  { text: "for you." },
];

/** Every figure here is stated in the About copy below — nothing invented. */
const credits = [
  { figure: "60", unit: "yrs", label: "In film and television" },
  { figure: "100", unit: "+", label: "Films made worldwide" },
  { figure: "30", unit: "+", label: "Countries produced in" },
  { figure: "2019", unit: "", label: "Coaching directly since" },
];

const workedWith = [
  "Michael Caine",
  "The Who",
  "Roger Moore",
  "Deep Purple",
  "Lee Marvin",
  "Jack Nicholson",
  "Sir John Gielgud",
  "Mickey Rooney",
];

/**
 * The working life, in order. Dates are only given where the catalogue or
 * the About copy states them; the rest stay at the decade. `work` names a
 * catalogue title, so a milestone links to the work's own page when it has
 * one — and quietly doesn't when it hasn't.
 */
const milestones: {
  when: string;
  title: string;
  note: string;
  work?: string;
  href?: string;
}[] = [
  {
    when: "1960s",
    title: "The Avengers",
    note: "His first job: assistant director on the television series. Senior responsibilities followed before he turned 21.",
  },
  {
    when: "1974",
    title: "Gold",
    note: "Roger Moore’s adventure, produced by his father, Michael Klinger.",
    work: "Gold",
  },
  {
    when: "1975",
    title: "Deep Purple Rises Over Japan",
    note: "Filmed at the Budokan, Tokyo, on 15 December 1975.",
    work: "Deep Purple Rises Over Japan",
  },
  {
    when: "1976",
    title: "Shout at the Devil",
    note: "Roger Moore and Lee Marvin, made with Michael Klinger.",
    work: "Shout at the Devil",
  },
  {
    when: "1979",
    title: "The Kids Are Alright",
    note: "The Who’s concert documentary — an inside look at the band, with performances and interviews.",
    work: "The Kids Are Alright",
  },
  {
    when: "2008",
    title: "Full Circle",
    note: "A documentary on the INS Dakar, the Israeli submarine lost in 1968, and a son’s search for it.",
    work: "Full Circle",
  },
  {
    when: "2016",
    title: "Give-Get-Go",
    note: "His own venture: books, feature films and documentaries under one name.",
    href: "/give-get-go",
  },
  {
    when: "2019",
    title: "Solo2Darwin",
    note: "A 1942 Tiger Moth flown solo from the UK to Darwin. The same year, he began coaching directly.",
    work: "Solo2Darwin",
  },
  {
    when: "Now",
    title: "The coaching programme",
    note: "Memberships, courses, cohorts and one-to-one sessions — the experience above, passed on.",
    href: "/coaching",
  },
];

/** The span of the working life, drawn along the foot of the "Six decades"
 *  feature: first credit in the mid-sixties, coaching today. */
const decades = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

/** Hero entrance stagger. Short: the whole title card lands inside a second. */
const beat = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties;

/** The cheapest active price of a kind, or null. */
function lowest(prices: ProductPrice[], kind: "recurring" | "one_time") {
  const matching = prices.filter((p) =>
    kind === "recurring" ? p.billing_type === "recurring" : p.billing_type !== "recurring",
  );
  if (matching.length === 0) return null;
  return matching.reduce((a, b) => (b.amount < a.amount ? b : a));
}

const eyebrow = "text-xs font-semibold tracking-[0.2em] uppercase";

export default async function HomePage() {
  // Fetched together: independent reads on one page should not be sequential
  // waits.
  const [testimonials, works, tiers, courses, cohorts, services] =
    await Promise.all([
      listTestimonials({ featuredOnly: true, limit: 6 }),
      listCatalogue(),
      listMembershipTiers(),
      listCourses(),
      listCohorts(),
      listCoachingServices(),
    ]);

  // Only works that actually have a cover: a strip of empty frames is worse
  // than no strip.
  const featuredWorks = works.filter((w) => w.storage_path).slice(0, 14);

  // The catalogue's real breadth, counted rather than claimed.
  const counts = CATALOGUE_CATEGORIES.map((c) => ({
    label: c.label,
    count: works.filter((w) => w.category === c.slug).length,
  }))
    // A category of one is not breadth; it is shown on the catalogue page.
    .filter((c) => c.count > 1);

  const byTitle = new Map<string, CatalogueItem>(works.map((w) => [w.title, w]));
  const timeline = milestones.map((m) => {
    const work = m.work ? byTitle.get(m.work) : undefined;
    const link = work ? workHref(work) : null;
    return { ...m, link: m.href ? { href: m.href, external: false } : link };
  });

  /*
    THE OFFERS. Every price below is read from the storefront's own tables,
    so the home page cannot quote a figure the checkout would contradict. An
    offer with no live price shows its note instead; nothing is invented.
    The detail (tiers, series, course titles) lives on the coaching pages —
    the home page only points at them (owner, 2026-09-26).
  */
  const price = (p: ProductPrice | null) => (p ? formatPrice(p.amount, p.currency) : null);
  const fromMonthly = lowest(tiers.flatMap((t) => t.prices), "recurring");

  const offers: { title: string; href: string; summary: string; price: string | null; priceNote: string }[] = [
    {
      title: "Membership",
      href: "/coaching/memberships",
      summary: "Monthly access that grows with each tier.",
      price: price(fromMonthly),
      priceNote: "a month",
    },
    {
      title: "Group Coaching",
      href: "/coaching/group-coaching",
      summary: "Eight live sessions, up to eight people.",
      price: null,
      priceNote: "Included with membership",
    },
    {
      title: "Courses",
      href: "/coaching/courses",
      summary: "Self-paced, in the Academy.",
      price: price(lowest(courses.flatMap((c) => c.prices), "one_time")),
      priceNote: "per course",
    },
    {
      title: "Interactive Cohorts",
      href: "/coaching/cohorts",
      summary: "Eight three-hour workshops on Zoom.",
      price: price(lowest(cohorts.flatMap((c) => c.prices), "one_time")),
      priceNote: "per cohort",
    },
    {
      title: "Private Coaching",
      href: "/coaching/private-coaching",
      summary: "One to one with Tony.",
      price: price(lowest(services.flatMap((s) => s.prices), "one_time")),
      priceNote: "per session",
    },
    {
      title: "Retreats",
      href: "/coaching/retreats",
      summary: "Immersive, limited-place experiences.",
      price: null,
      priceNote: "Limited places",
    },
  ];

  const silver = tiers.find((t) => t.rank === 1);
  const silverMonthly = silver ? price(lowest(silver.prices, "recurring")) : null;

  const nextSteps = [
    {
      title: "Read, watch and listen",
      line: "Free — the catalogue, Stories From The Front Line, and the blog.",
      href: "/catalogue",
      cta: "Browse the catalogue",
    },
    {
      title: silver ? `Join ${silver.name} membership` : "Join as a member",
      line:
        silver && silverMonthly
          ? `${silverMonthly} a month: ${silver.benefits
              .map((b) => b[0].toLowerCase() + b.slice(1))
              .join(", and ")}.`
          : "Every tier includes everything below it.",
      href: "/coaching/memberships",
      cta: "Compare membership",
    },
    {
      title: "Ask Tony a question",
      line: "Not sure which offer fits? Ask before you buy anything.",
      href: "/contact",
      cta: "Get in touch",
    },
  ];

  return (
    <>
      {/*
        HERO — a title card, not a card grid (note 01 §22, note 10 §5).

        The field is `block-noir`, sampled from the photograph's own black
        backdrop, and the photo is masked into it rather than framed. The
        words share the left edge of every other section's content (the
        default container) and sit centred in the space above the credits
        line, not pressed against the header. The photo starts below the
        header, so Tony has headroom rather than a cropped crown.

        All motion here is CSS (globals.css), so it plays from the
        server-rendered HTML without waiting for hydration, and each piece
        opts out under reduced motion.
      */}
      <section className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground">
        <figure
          className={cn(
            "absolute inset-x-0 top-0 -z-10 h-[60svh] max-h-152 min-h-88",
            "lg:top-[7%] lg:bottom-0 lg:left-auto lg:h-auto lg:max-h-none lg:w-[60%]",
            "mask-[linear-gradient(to_bottom,black_45%,transparent)]",
            "lg:mask-[linear-gradient(to_right,transparent,black_35%,black_88%,transparent),linear-gradient(to_bottom,black_70%,transparent)] lg:mask-intersect",
          )}
        >
          <div className="absolute inset-0 animate-[settle_2.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
            <Image
              src={designPhotos.homeHero.src}
              alt={designPhotos.homeHero.alt}
              fill
              priority
              fetchPriority="high"
              quality={90}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-[50%_12%]"
            />
          </div>
        </figure>

        {/* A projector's light leak: one blurred oxblood glow drifting slowly
            behind the type. Decoration only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[30%] left-[-15%] -z-10 aspect-square w-[70vw] max-w-4xl rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--block-oxblood)_85%,transparent),transparent)] opacity-70 blur-3xl animate-[leak-drift_22s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
        />

        <Container className="relative flex min-h-[calc(100svh-4rem)] flex-col pt-[44svh] pb-8 lg:min-h-[calc(100svh-4.5rem)] lg:pt-(--hero-text-top) lg:pb-12">
          {/* From lg the words start at --hero-text-top, the height every
              page hero shares, rather than centring. */}
          <div className="my-auto py-10 lg:my-0 lg:py-0">
            <p
              className={cn(
                "flex items-center gap-4 text-[0.6875rem] font-semibold tracking-[0.16em] text-block-foreground/75 uppercase sm:text-xs sm:tracking-[0.24em]",
                "animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none",
              )}
              style={beat(100)}
            >
              <span aria-hidden="true" className="hidden h-px w-10 bg-block-foreground/50 sm:block" />
              Producer &middot; Director &middot; Author &middot; Coach
            </p>

            {/* The landing title-card size (note 10 §9.1), shared by the top-level
                pages. On phones it follows the screen width, so the long first
                line always fits whole on one line. Only the leading is tighter
                here, for the three stacked lines. */}
            <h1 className="title-card mt-6 leading-[0.92]">
              {headline.map((line, i) => (
                // Padding below and a matching negative margin give italic
                // descenders room inside the clipping mask.
                <span key={line.text} className="mb-[-0.1em] block overflow-hidden pb-[0.1em] whitespace-nowrap">
                  <span
                    className={cn(
                      "block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none",
                      line.italic &&
                        "font-normal text-[color-mix(in_oklab,var(--block-foreground)_70%,var(--block-oxblood))] italic",
                    )}
                    style={beat(180 + i * 110)}
                  >
                    {line.text}
                  </span>
                </span>
              ))}
            </h1>

            <p
              className="mt-7 max-w-124 text-lg leading-relaxed text-block-foreground/80 text-pretty animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
              style={beat(720)}
            >
              First credit, <em>The Avengers</em>. Producer of{" "}
              <em>The Kids Are Alright</em>. Now passing on what a hundred films
              taught him to the next generation of filmmakers, writers and
              producers.
            </p>

            <div
              className="mt-9 flex flex-wrap gap-3 animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
              style={beat(840)}
            >
              <ButtonLink href="/coaching" size="lg">
                Explore coaching
                <ButtonArrow />
              </ButtonLink>
              <ButtonLink href="/catalogue" size="lg" variant="onBlockOutline">
                Browse the catalogue
              </ButtonLink>
            </div>
          </div>

          {/* Bottom-right of the title card, over the photo's faded foot —
              never beside the headline (see PhotoCredit). */}
          <PhotoCredit src={designPhotos.homeHero.src} variant="overlay" />
        </Container>

        {/* The credits line: the career in four figures, set like the billing
            block at the foot of a poster. It sits BELOW the full-screen title
            card, on the same field, rather than inside it — a row the fold
            cuts in half reads as a mistake, one just past it reads as the
            next thing to scroll to. */}
        <Container className="pb-14 sm:pb-20">
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-block-foreground/15 pt-7 animate-[fade-up_1s_var(--ease-out-expo)_both] motion-reduce:animate-none lg:grid-cols-4 lg:items-start"
            style={beat(980)}
          >
            {credits.map((c) => (
              <div key={c.label}>
                <p className="font-display text-4xl leading-none font-semibold tabular-nums sm:text-5xl">
                  {c.figure}
                  <span
                    className={cn(
                      "text-block-foreground/55",
                      // A word unit is set smaller and spaced, so "60 yrs"
                      // does not read as one word.
                      c.unit.length > 1 && "ml-1.5 text-2xl sm:text-3xl",
                    )}
                  >
                    {c.unit}
                  </span>
                </p>
                <p className="mt-2.5 max-w-48 text-xs leading-snug font-medium tracking-[0.08em] text-block-foreground/65 uppercase">
                  {c.label}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* WORKED WITH — the names do the talking, in a line of credits that
          never quite ends. Page ground, so it rests the eye between two
          saturated fields. More room below than above (owner, 2026-09-26),
          so the names settle before About Tony starts. */}
      <section className="border-b border-border pt-16 pb-20 sm:pt-24 sm:pb-28">
        <p className={cn(eyebrow, "mb-12 text-center text-muted-foreground sm:mb-16")}>
          On set with
        </p>
        <Marquee items={workedWith} label="Tony has worked with" />
      </section>

      {/* ABOUT TONY — a split weighted to the words (5:7), because this is the
          one place on the page that carries several paragraphs. The page's
          first photos take different formats (note 10 §42.3): dissolved into
          the hero, edge to edge here, a banner next. */}
      <PhotoSplit image={designPhotos.homeAbout} split="text">
        <Reveal className="leading-relaxed text-pretty">
          <Eyebrow>About Tony</Eyebrow>
          <h2 className="mt-5 font-display">
            On set in the mid-sixties. In charge before he was twenty-one.
          </h2>
          <p className="mt-8 text-lg sm:text-xl">
            Tony Klinger is an award-winning producer, director and educator
            with decades of experience in the international film industry. He
            began as an assistant director on <em>The Avengers</em>, and had
            taken on senior responsibilities before he turned 21.
          </p>
          <div className="mt-8 grid gap-6 text-muted-foreground sm:grid-cols-2 sm:gap-10">
            <p>
              His work includes <em>The Kids Are Alright</em> with The Who,{" "}
              <em>Deep Purple Rises Over Japan</em> and <em>The Butterfly Ball</em>,
              and collaborations with his father, the producer Michael Klinger,
              on <em>Gold</em> and <em>Shout at the Devil</em>. He has produced
              across more than thirty countries.
            </p>
            <p>
              He is also an author, has taught at the Bournemouth Film School and
              the University of East London, and holds The Queen&apos;s
              Anniversary Award for Education. In 2016 he founded Give-Get-Go,
              and in 2019 began coaching directly.
            </p>
          </div>
          <div className="mt-10">
            <ButtonLink href="/about" variant="outline">
              Read Tony&apos;s story
              <ButtonArrow />
            </ButtonLink>
          </div>
        </Reveal>
      </PhotoSplit>

      {/* SIX DECADES — the timeline sets out the record (real titles and
          years, each linking to the work where it has a page); the banner
          after it sums it up in one line. */}

      <section aria-labelledby="timeline-heading" className="py-18 sm:py-24">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2
              id="timeline-heading"
              className="max-w-2xl font-display"
            >
              A working life, in the order it happened.
            </h2>
            <p className="max-w-sm text-muted-foreground">
              A selection. The full record is in the{" "}
              <Link href="/catalogue" className="text-primary underline underline-offset-4 hover:no-underline">
                catalogue
              </Link>
              .
            </p>
          </div>

          <Carousel
            label="Tony Klinger's career, decade by decade"
            interval={4500}
            className="mt-16"
            // Exact fractions of the row, never a fixed width: every position
            // shows whole milestones only — none caught halfway (owner,
            // 2026-09-24).
            slideClassName="w-full sm:w-1/2 lg:w-1/3"
          >
            {timeline.map((m) => (
              <article key={m.title} className="relative h-full border-t border-foreground/25 pt-10 pr-10">
                {/* The mark on the line: filled for a dated event, open for a
                    decade, so an approximate date never looks exact. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -top-1.5 left-0 h-2.75 w-2.75 rounded-full border-2 border-primary",
                    /^\d{4}$/.test(m.when) ? "bg-primary" : "bg-background",
                  )}
                />
                <p className="font-display text-5xl leading-none font-semibold tracking-[-0.02em] tabular-nums sm:text-[3.6rem]">
                  {m.when}
                </p>
                <h3 className="mt-8 font-display text-2xl leading-snug font-semibold italic">
                  {m.title}
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{m.note}</p>
                {m.link ? (
                  <Link
                    href={m.link.href}
                    {...(m.link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {m.work ? "About the work" : "Find out more"}
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                ) : null}
              </article>
            ))}
          </Carousel>
        </Container>
      </section>

      {/*
        SIX DECADES — a full-bleed feature, not a cropped strip.

        Framed at 3:2 (the photo's own shape, capped at the viewport height)
        and pinned to the top, so Tony's head is never cut. The words sit
        bottom-left over his shoulder on a scrim; along the foot runs the
        span of the career, decade by decade, as a ruler — the claim in the
        headline drawn as a line you can read.
      */}
      <section
        aria-label="Six decades"
        className="relative isolate flex min-h-176 w-full items-end overflow-hidden bg-block-noir text-white md:aspect-3/2 md:max-h-svh md:min-h-144"
      >
        {/* Tony stands dead centre in this frame, so on a 3:2 field the words
            sat on his face (owner, 2026-09-24). From tablet up the photo takes
            the right-hand part only and dissolves leftwards into the noir
            field, like the home hero; the words get the dark left side. On a
            phone there is no side to spare, so the photo takes the top and
            dissolves downwards, and the words sit on the noir beneath it. */}
        <div className="absolute inset-x-0 top-0 -z-20 h-[62%] mask-[linear-gradient(to_bottom,black_55%,transparent)] md:inset-x-auto md:inset-y-0 md:right-0 md:h-auto md:w-[62%] md:mask-[linear-gradient(to_right,transparent,black_32%)] lg:w-[58%]">
          <Image
            src={designPhotos.homeBanner.src}
            alt={designPhotos.homeBanner.alt}
            fill
            quality={90}
            sizes="(min-width: 1024px) 58vw, (min-width: 768px) 62vw, 100vw"
            className={cn("object-cover", designPhotos.homeBanner.focus)}
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/35 via-45% to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden bg-linear-to-r from-black/45 via-transparent via-50% to-transparent lg:block"
        />

        <Container className="pb-15 sm:pb-18">
          <Reveal className="max-w-3xl md:max-w-100 lg:max-w-136">
            <p className={cn(eyebrow, "text-white/80")}>Six decades</p>
            <p className="mt-4 font-display text-[clamp(2rem,1.3rem+2.6vw,3.75rem)] leading-[1.05] font-semibold text-balance">
              From <em>The Avengers</em> to <em>The Kids Are Alright</em>, and
              more than a hundred films since.
            </p>
          </Reveal>

          <Reveal delay={120} className="mt-12 sm:mt-16">
            <ol aria-label="Decades of Tony's career" className="grid grid-cols-7 border-t border-white/35">
              {decades.map((d, i) => (
                <li key={d} className="relative pt-4">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -top-1.25 left-0 h-2.25 w-2.25 rounded-full",
                      i === 0 || i === decades.length - 1 ? "bg-primary" : "bg-white/70",
                    )}
                  />
                  <span className="text-[0.8rem] text-white/90 tabular-nums sm:text-xl">{d}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </Container>
        <PhotoCredit src={designPhotos.homeBanner.src} variant="overlay" />
      </section>

      {/* THE WORK — the catalogue, before the coaching that draws on it.
          The header counts the catalogue rather than describing it. Noir, the
          hero's field: covers read best on near-black, like a screening room. */}
      {featuredWorks.length > 0 ? (
        <Band tone="noir" spacing="balanced">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className={cn(eyebrow, "text-block-foreground/70")}>The catalogue</p>
              <h2 className="mt-5 font-display">
                Films, books and recordings.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-block-foreground/85">
                The work itself, not a description of it.
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-10 gap-y-6">
              {counts.slice(0, 4).map((c) => (
                <div key={c.label}>
                  <dt className="text-xs font-medium tracking-[0.08em] text-block-foreground/65 uppercase">
                    {c.label}
                  </dt>
                  <dd className="mt-1 font-display text-4xl leading-none font-semibold tabular-nums">
                    {c.count}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Keeps gliding, like the "On set with" names, and can still be
              stepped back and forth (note 10 §37). */}
          <LoopingStrip
            label="Works from the catalogue"
            tone="block"
            className="mt-16"
            slideClassName="w-60 sm:w-64 lg:w-66"
          >
            {featuredWorks.map((work) => (
              <WorkCard key={work.id} item={work} tone="ink" />
            ))}
          </LoopingStrip>

          <div className="mt-12">
            <ButtonLink href="/catalogue" variant="onBlockOutline">
              See the whole catalogue
              <ButtonArrow />
            </ButtonLink>
          </div>
        </Band>
      ) : null}

      {/*
        COACHING — a short signpost, not a price list (owner, 2026-09-26: the
        /coaching pages already carry the detail). On the warm paper tone so it
        parts from the noir catalogue above and the testimonials below. The six
        offers are a plain ruled list, no cards (owner), each linking to its own
        page with its starting price.
      */}
      <section aria-labelledby="coaching-heading" className="bg-surface-muted py-18 sm:py-24">
        <Container>
          <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>Coaching</Eyebrow>
              <h2 id="coaching-heading" className="mt-5 font-display">
                Tony&apos;s coaching solves your problems.
              </h2>
              <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground text-pretty">
                Direct answers from someone who has done the job, not theory
                from someone who has read about it.
              </p>
            </div>
            <ButtonLink href="/coaching" size="lg" variant="primary" className="justify-self-start">
              Explore coaching
              <ButtonArrow />
            </ButtonLink>
          </Reveal>

          {/* Still no cards (owner), but each offer stands on its own (owner,
              2026-09-26: the rows read as mixed together): its own top rule,
              led by a short red stroke, and clear space between offers in
              both directions rather than one continuous ruled table. */}
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:mt-12 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-14 lg:gap-y-12">
            {offers.map((offer, i) => (
              <Reveal as="li" key={offer.href} delay={(i % 3) * 60}>
                <Link
                  href={offer.href}
                  className="group relative flex h-full flex-col border-t border-foreground/20 pt-5 focus-visible:outline-offset-4"
                >
                  {/* The lead stroke, drawing across the whole rule on hover. */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-px left-0 h-0.5 w-10 bg-primary transition-[width] duration-(--dur-slow) ease-expo group-hover:w-full motion-reduce:transition-none"
                  />
                  <span className="font-display text-xl leading-tight font-semibold">
                    {offer.title}
                    <span
                      aria-hidden="true"
                      className="ml-3 inline-block text-base text-muted-foreground transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1.5 group-hover:text-accent motion-reduce:transform-none"
                    >
                      &rarr;
                    </span>
                  </span>
                  <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.summary}</span>
                  <span className="mt-auto pt-4">
                    {offer.price ? (
                      <span className="mr-2 text-xs tracking-[0.06em] text-muted-foreground uppercase">From</span>
                    ) : null}
                    {offer.price ? (
                      <span className="font-display text-xl leading-none font-semibold tabular-nums">{offer.price}</span>
                    ) : null}
                    <span className={cn("text-xs tracking-[0.06em] text-muted-foreground uppercase", offer.price && "ml-2")}>
                      {offer.priceNote}
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/*
        VOICES — one voice at a time, set large, and moving on by itself
        (the shared Carousel: whole slides, pause, back and forth). A quote
        is speech, not a widget, so there are no cards: a big line, the
        name beneath it, and room around it. Every quote is set at one size.
      */}
      {testimonials.length > 0 ? (
        <section aria-labelledby="voices-heading" className="py-18 sm:py-24 lg:py-30">
          <Container>
            {/* `grid-cols-1` is load-bearing: without declared columns the track
                sizes to its content and the carousel stretched it past a phone. */}
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
              <div className="lg:pt-4">
                <Eyebrow>Testimonials</Eyebrow>
                <h2 id="voices-heading" className="mt-5 font-display">
                  In their words.
                </h2>
                <p className="mt-6 max-w-xs leading-relaxed text-muted-foreground">
                  What writers, filmmakers and producers said after working
                  with Tony.
                </p>
                <div className="mt-10">
                  <ButtonLink href="/about/testimonials" variant="outline">
                    Read them all
                    <ButtonArrow />
                  </ButtonLink>
                </div>
              </div>

              <Carousel
                label="What Tony's clients say"
                interval={7000}
                slideClassName="w-full"
                fitHeight
              >
                {testimonials.map((t, i) => (
                  // A steady floor, so a short quote does not collapse the
                  // stage; a longer one grows it (fitHeight follows).
                  <figure key={t.id} className="relative flex min-h-60 flex-col pr-2 sm:min-h-64">
                    <div className="flex items-end justify-between border-b border-border pb-3">
                      <span aria-hidden="true" className="block h-12 font-display text-[6rem] leading-none text-primary">
                        &ldquo;
                      </span>
                      <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
                      </span>
                    </div>
                    <blockquote
                      className={cn(
                        // Body face, never the display serif (owner,
                        // 2026-09-26). One size for every quote, whatever its
                        // length, with a moderate line height.
                        "mt-8 text-[0.9375rem] leading-[1.55] font-medium text-pretty sm:text-xl sm:leading-normal",
                      )}
                    >
                      {t.quote}
                    </blockquote>
                    {t.attributed_to || t.attribution_detail ? (
                      <figcaption className="mt-auto flex items-center gap-4 pt-8">
                        <span aria-hidden="true" className="h-px w-12 bg-primary" />
                        <span>
                          {t.attributed_to ? (
                            <cite className="block font-semibold not-italic">{t.attributed_to}</cite>
                          ) : null}
                          {t.attribution_detail ? (
                            <span className="block text-sm text-muted-foreground">{t.attribution_detail}</span>
                          ) : null}
                        </span>
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </Carousel>
            </div>
          </Container>
        </section>
      ) : null}

      {/*
        CLOSING — the last thing before the footer: three real ways in, set
        as three columns under one large line. Each step is a whole link; its
        rule draws across in red and its number fills in on hover.
      */}
      <Band
        tone="noir"
        spacing="balanced"
        backdrop={
          // A faint still behind the closing line (owner, 2026-09-24): Tony
          // beside a film camera outside a cinema, black and white, at a
          // whisper. Decorative, so no alt; weighted right, where Tony stands,
          // and fading out under the words.
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-[0.1] mask-[linear-gradient(to_right,transparent_5%,black_60%)]"
          >
            <Image
              src={designPhotos.closing.src}
              alt=""
              fill
              quality={75}
              sizes="100vw"
              className={cn("object-cover grayscale", designPhotos.closing.focus)}
            />
          </div>
        }
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <h2 className="max-w-3xl font-display">
            Start where it suits you.
          </h2>
          <p className="max-w-sm leading-relaxed text-block-foreground/75 lg:text-right">
            Browsing is open to everyone. An account is only needed for what
            you buy.
          </p>
        </div>

        <ol className="mt-16 grid gap-x-10 gap-y-2 sm:mt-20 md:grid-cols-3">
          {nextSteps.map((step, i) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className={cn(
                  "group relative flex h-full flex-col border-t border-block-foreground/25 pt-8 pb-10 focus-visible:outline-offset-4",
                  "after:absolute after:inset-x-0 after:-top-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-(--dur-slow) after:ease-expo hover:after:scale-x-100 motion-reduce:after:transition-none",
                )}
              >
                <span
                  aria-hidden="true"
                  className="font-display text-7xl leading-none font-semibold text-transparent tabular-nums transition-colors duration-(--dur-base) [-webkit-text-stroke:1px_color-mix(in_oklab,var(--block-foreground)_45%,transparent)] group-hover:text-block-foreground"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-8 font-display text-2xl leading-snug font-semibold">{step.title}</span>
                <span className="mt-3 flex-1 leading-relaxed text-block-foreground/75">{step.line}</span>
                <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold">
                  {step.cta}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1.5 motion-reduce:transform-none"
                  >
                    &rarr;
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Band>
    </>
  );
}
