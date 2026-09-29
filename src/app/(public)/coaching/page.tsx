import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { TestimonialVideoCard } from "@/components/content/TestimonialVideos";
import { Carousel } from "@/components/motion/Carousel";
import { Band } from "@/components/layout/Band";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { formatPrice } from "@/lib/commerce/pricing";
import {
  listCoachingServices,
  listCohorts,
  listCourses,
  listMembershipTiers,
  type ProductPrice,
} from "@/lib/content/coaching";
import { listTestimonialVideos } from "@/lib/content/testimonial-videos";
import { listTestimonials } from "@/lib/content/testimonials";
import { designPhotos } from "@/lib/site/design-photos";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Coaching",
  description:
    "Membership, courses, group coaching, cohorts, private coaching and retreats with Tony Klinger — and how buying, access and booking fit together.",
};

function lowest(prices: ProductPrice[], kind: "recurring" | "one_time") {
  const matching = prices.filter((p) =>
    kind === "recurring" ? p.billing_type === "recurring" : p.billing_type !== "recurring",
  );
  if (matching.length === 0) return null;
  return matching.reduce((a, b) => (b.amount < a.amount ? b : a));
}

const eyebrow = "text-xs font-semibold tracking-[0.2em] uppercase";

type Offer = { title: string; href: string; from: string | null };

/**
 * How it works — formerly its own page, /coaching/about (now a redirect
 * here). Five words a visitor can hold in their head, set as a path rather
 * than a numbered list: the order is carried by the line joining them.
 */
const STEPS = [
  ["Choose", "A course, a series, a cohort, a retreat or a membership tier."],
  ["Pay", "Once, or by subscription. No account needed to check out — make one after."],
  ["Access", "What you bought is attached to your account the moment payment clears."],
  ["Book", "Where something is scheduled, pick your slot with what you already hold."],
  ["Attend", "Sessions, workshops and lessons all happen in the Academy."],
] as const;

/**
 * Coaching — note 03 §9.
 *
 * The storefront's front door, and since 2026-09-26 its only overview: the
 * separate "About" page and the secondary nav bar under the masthead are gone
 * (the Coaching menu already lists every page). In order: a full-bleed photo
 * hero of coaching as it happens; the offers as cards grouped by how you want
 * to work; how buying, access and booking fit; the membership ladder; then
 * clients on camera and in writing.
 */
export default async function CoachingPage() {
  const [tiers, courses, cohorts, services, quotes, videos] = await Promise.all([
    listMembershipTiers(),
    listCourses(),
    listCohorts(),
    listCoachingServices(),
    listTestimonials({ context: "coaching", limit: 8 }),
    listTestimonialVideos(),
  ]);

  // "From" figures are read from the storefront, so this page cannot quote a
  // price the checkout contradicts. No price, no figure — never a placeholder.
  // The carousel is as tall as its longest quote, so a paragraph-length one
  // would leave every short quote floating in empty space. Keep it to lines.
  const lines = quotes.filter((t) => t.quote.length <= 200);

  const price = (p: ProductPrice | null, suffix = "") =>
    p ? `From ${formatPrice(p.amount, p.currency)}${suffix}` : null;


  /*
    THE SIX OFFERS, GROUPED BY HOW YOU WANT TO WORK. A visitor rarely arrives
    knowing the product name; they know whether they want to learn alone, in a
    room with others, or with Tony himself.
  */
  const ways: {
    label: string;
    heading: string;
    photo: { src: string; alt: string; focus?: string };
    offers: Offer[];
  }[] = [
    {
      label: "On your own",
      heading: "At your pace, whenever you have the time.",
      // The shared focus is set for a tall frame; this strip is wide, so it
      // is pulled down to his face.
      photo: { ...designPhotos.courses, focus: "object-[50%_45%]" },
      offers: [
        {
          title: "Membership",
          href: "/coaching/memberships",
          from: price(lowest(tiers.flatMap((t) => t.prices), "recurring"), " a month"),
        },
        // The lead course by name (owner, 2026-09-26), then the rest. `courses`
        // is in curated order, so the first one is the one to lead with.
        ...courses.slice(0, 1).map((c) => ({
          title: c.title,
          href: `/coaching/courses/${c.slug}`,
          from: price(lowest(c.prices, "one_time")),
        })),
        {
          title: courses.length > 1 ? "All courses" : "Courses",
          href: "/coaching/courses",
          from: price(lowest(courses.flatMap((c) => c.prices), "one_time")),
        },
      ],
    },
    {
      label: "With a group",
      heading: "Alongside people facing the same problems.",
      photo: designPhotos.aboutTalk,
      offers: [
        {
          title: "Group Coaching",
          href: "/coaching/group-coaching",
          from: null,
        },
        {
          title: "Interactive Cohorts",
          href: "/coaching/cohorts",
          from: price(lowest(cohorts.flatMap((c) => c.prices), "one_time")),
        },
        {
          title: "Retreats",
          href: "/coaching/retreats",
          from: null,
        },
      ],
    },
    {
      label: "One to one",
      heading: "Your project, and Tony\u2019s full attention.",
      photo: designPhotos.privateCoaching,
      offers: [
        {
          title: "Private Coaching",
          href: "/coaching/private-coaching",
          from: price(lowest(services.flatMap((s) => s.prices), "one_time"), " a session"),
        },
      ],
    },
  ];

  return (
    <>
      {/*
        HERO — full bleed. The photograph is coaching as it happens (Tony
        after a talk, two people hanging on what he says), and it fills the
        screen so the page opens on the room, not on a layout. The words sit
        on its darkened foot. Not a split hero (owner, 2026-09-25).

        From lg the photo is set in from the left and feathered into the noir
        (owner, 2026-09-26), so the room sits to the right of the words rather
        than under them, and the words start at --hero-text-top like every
        other page hero instead of sinking to the foot.
      */}
      <section className="relative isolate flex min-h-[min(88svh,56rem)] items-end overflow-hidden bg-block-noir text-block-foreground lg:items-start">
        <div className="absolute inset-0 -z-10 animate-[settle_2.6s_var(--ease-out-expo)_both] motion-reduce:animate-none lg:left-[30%] lg:mask-[linear-gradient(to_right,transparent,black_30%)]">
          <Image
            src={designPhotos.coachingHero.src}
            alt={designPhotos.coachingHero.alt}
            fill
            priority
            fetchPriority="high"
            quality={90}
            sizes="100vw"
            className={cn("object-cover", designPhotos.coachingHero.focus)}
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-block-noir via-block-noir/55 to-block-noir/10"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-r from-block-noir/70 via-transparent to-transparent"
        />
        <Container className="pt-40 pb-14 sm:pb-20 lg:pt-(--hero-text-top)">
          <Reveal className="max-w-3xl">
            <p className={cn(eyebrow, "flex items-center gap-4 text-block-foreground/80")}>
              <span aria-hidden="true" className="h-px w-10 bg-primary" />
              Coaching
            </p>
            {/* Smaller than the title card (owner, 2026-09-26): at full size
                the line crowded the photo. */}
            <h1 className="mt-5 text-[clamp(2.75rem,1.9rem+3.2vw,4.75rem)] leading-[0.95] tracking-[-0.03em] text-balance">
              Work with Tony
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-block-foreground/85 text-pretty sm:text-xl lg:max-w-xl">
              The script that will not come together, the budget that will not
              stretch, the film nobody will distribute. Tony has met each of
              them in six decades of production, and he will tell you plainly
              what he would do.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="#ways-in" size="lg">
                Find your way in
              </ButtonLink>
              <ButtonLink href="/contact" size="lg" variant="onBlockOutline">
                Ask Tony a question
              </ButtonLink>
            </div>
          </Reveal>
        </Container>
      </section>

      {/*
        WAYS IN — one row, three cards, one per way of working: a short photo
        strip, the way and one line, then its offers as tight rows with their
        prices. Fits about one screen. (Owner, 2026-09-26: the earlier photo
        chapters were too long and tiring; before that, stacked offer boxes in
        columns were congested.)
      */}
      <section id="ways-in" aria-labelledby="ways-in-title" className="scroll-mt-28 py-20 sm:py-24">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow align="center">Ways in</Eyebrow>
            <h2 id="ways-in-title" className="mt-5 text-balance">
              Three ways to work with Tony.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3 lg:gap-8">
            {ways.map((way, w) => (
              <Reveal
                key={way.label}
                delay={w * 80}
                className="flex flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card"
              >
                <div className="relative aspect-video bg-surface-muted">
                  <Image
                    src={way.photo.src}
                    alt={way.photo.alt}
                    fill
                    quality={75}
                    sizes="(min-width: 768px) 30vw, 100vw"
                    className={cn("object-cover", way.photo.focus)}
                  />
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <h3 className="font-display text-2xl font-semibold">{way.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{way.heading}</p>
                  <ul className="mt-5 border-t border-border">
                    {way.offers.map((offer) => (
                      <li key={offer.href} className="border-b border-border">
                        <Link
                          href={offer.href}
                          className="group flex items-center justify-between gap-4 py-3.5 focus-visible:outline-offset-4"
                        >
                          <span>
                            <span className="block font-medium transition-colors duration-(--dur-fast) group-hover:text-accent">
                              {offer.title}
                            </span>
                            {offer.from ? (
                              <span className="block text-xs text-muted-foreground tabular-nums">{offer.from}</span>
                            ) : null}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-muted-foreground transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 group-hover:text-accent motion-reduce:transform-none"
                          >
                            &rarr;
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/*
        HOW IT WORKS — on noir, set like a programme: five short words down
        the page, each on its own line with room around it, and one sentence
        beside it. The order reads top to bottom, so no numerals. Then the
        promise that follows from keeping paying, access and booking apart.
      */}
      <Band tone="noir">
        <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow align="center">How it works</Eyebrow>
            <h2 id="how-it-works-title" className="mt-5 text-balance">
              From choosing to the room.
            </h2>
          </Reveal>

          <ol className="mx-auto mt-12 max-w-4xl border-t border-block-foreground/15">
            {STEPS.map(([title, body], i) => (
              <Reveal
                as="li"
                key={title}
                delay={i * 60}
                className="grid gap-3 border-b border-block-foreground/15 py-6 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-baseline sm:gap-10 sm:py-7"
              >
                <p className="font-display text-3xl font-semibold sm:text-4xl">{title}</p>
                <p className="text-lg leading-relaxed text-block-foreground/70 text-pretty">{body}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-xl leading-snug font-medium text-balance sm:text-2xl">
              If your membership already covers what you are booking, you are
              never asked to pay for it again.
            </p>
          </Reveal>
        </section>
      </Band>

      {/*
        MEMBERSHIP — four tiers, four equal cards with room inside: the name,
        what it adds, and the monthly price set large at the foot. On the page
        ground between the two noir bands (owner, 2026-09-26: not the paper
        tone).
      */}
      {tiers.length > 0 ? (
        <section aria-labelledby="membership-title" className="py-20 sm:py-24">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow align="center">Membership</Eyebrow>
              <h2 id="membership-title" className="mt-5 text-balance">
                Steps, not alternatives.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-pretty">
                Each tier includes everything in the one before it. Start where
                you are and move up when you want more.
              </p>
            </Reveal>

            <ul className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {tiers.map((tier, i) => {
                const from = lowest(tier.prices, "recurring");
                const short = (name: string) => name.replace(/ Membership$/, "");
                return (
                  <Reveal as="li" key={tier.id} delay={i * 70}>
                    <Link
                      href={`/coaching/memberships/${tier.slug}`}
                      className="group flex h-full flex-col rounded-(--radius-lg) border border-border bg-surface p-7 shadow-card transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-1 hover:shadow-lift focus-visible:outline-offset-4 motion-reduce:transform-none"
                    >
                      <span className="font-display text-3xl font-semibold transition-colors duration-(--dur-fast) group-hover:text-accent">
                        {short(tier.name)}
                      </span>
                      {i > 0 ? (
                        <span className="mt-3 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          Everything in {short(tiers[i - 1].name)}, plus
                        </span>
                      ) : null}
                      <span className="mt-4 block flex-1 leading-relaxed text-muted-foreground text-pretty">
                        {tier.description}
                      </span>
                      <span className="mt-8 flex items-end justify-between gap-4 border-t border-border pt-5">
                        {from ? (
                          <span>
                            <span className="font-display text-4xl font-semibold tabular-nums">
                              {formatPrice(from.amount, from.currency)}
                            </span>
                            <span className="ml-1 text-sm text-muted-foreground">a month</span>
                          </span>
                        ) : (
                          <span className="text-sm font-medium">Join {short(tier.name)}</span>
                        )}
                        <span
                          aria-hidden="true"
                          className="text-muted-foreground transition-transform duration-(--dur-base) group-hover:translate-x-1 group-hover:text-accent motion-reduce:transform-none"
                        >
                          &rarr;
                        </span>
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </ul>

            <div className="mt-10 flex justify-center">
              <ButtonLink href="/coaching/memberships" size="lg" variant="outline">
                Compare every tier
                <ButtonArrow />
              </ButtonLink>
            </div>
          </Container>
        </section>
      ) : null}

      {/*
        ON CAMERA — every filmed testimonial in a carousel on noir: it moves
        on its own, with back, pause and forward, and stops for good once a
        clip is played. Whole frames only (owner's carousel rule).
      */}
      {videos.length > 0 ? (
        <Band tone="noir">
          <section aria-labelledby="on-camera-title">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <Reveal className="max-w-xl">
                <Eyebrow>On camera</Eyebrow>
                <h2 id="on-camera-title" className="mt-5 text-balance">
                  Clients, in their own words.
                </h2>
              </Reveal>
              <ButtonLink href="/about/testimonials" size="lg" variant="onBlockOutline" className="self-start sm:self-auto">
                Every testimonial
                <ButtonArrow />
              </ButtonLink>
            </div>

            <Carousel
              label="Filmed testimonials from Tony's clients"
              tone="block"
              interval={4500}
              className="mt-10"
              trackClassName="-mx-3"
              slideClassName="w-1/2 px-3 md:w-1/3 lg:w-1/4"
            >
              {videos.map((v) => (
                <TestimonialVideoCard key={v.id} video={v} plainCaption />
              ))}
            </Carousel>
          </section>
        </Band>
      ) : null}

      {/*
        IN WRITING — one quote at a time, set large in the centre with the
        page around it, turning slowly. A different shape from the home
        page's quote rail, so the two pages do not repeat each other.
      */}
      {lines.length > 0 ? (
        <section aria-labelledby="in-writing-title" className="py-20 sm:py-24">
          <Container width="narrow">
            <h2 id="in-writing-title" className="sr-only">What clients wrote</h2>
            <span aria-hidden="true" className="block text-center font-display text-8xl leading-none text-primary">
              &ldquo;
            </span>
            <Carousel label="What Tony's clients wrote" interval={8000} className="mt-6" slideClassName="w-full">
              {lines.map((t) => (
                <figure key={t.id} className="flex h-full flex-col items-center justify-center px-2 text-center">
                  <blockquote
                    className={cn(
                      "leading-[1.35] font-medium text-balance",
                      t.quote.length <= 120
                        ? "text-2xl sm:text-4xl"
                        : t.quote.length <= 260
                          ? "text-xl sm:text-3xl"
                          : "text-lg sm:text-2xl",
                    )}
                  >
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-10 text-sm">
                    {t.attributed_to ? <cite className="block font-semibold not-italic">{t.attributed_to}</cite> : null}
                    {t.attribution_detail ? (
                      <span className="block text-muted-foreground">{t.attribution_detail}</span>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </Carousel>
          </Container>
        </section>
      ) : null}

      {/* CLOSE — for the visitor who still does not know which way in. On the
          page ground, parted from the quotes by a hairline (owner, 2026-09-26:
          not the paper tone before the footer). */}
      <section className="border-t border-border py-20 sm:py-24">
        <Container width="narrow">
          <Reveal className="text-center">
            <h2 className="text-balance">Not sure where to start?</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Tell Tony what you are working on. He will say which of these
              fits — including when the answer is none of them yet.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/contact" size="lg">
                Ask Tony
                <ButtonArrow />
              </ButtonLink>
              <ButtonLink href="/coaching/group-coaching" size="lg" variant="outline">
                Try a group session
              </ButtonLink>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
