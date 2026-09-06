import type { Metadata } from "next";
import Link from "next/link";

import { Testimonials } from "@/components/content/Testimonials";
import { WorkCard } from "@/components/content/WorkCard";
import { Band, BandHeader } from "@/components/layout/Band";
import { Container, Section } from "@/components/layout/Container";
import { HeroCanvas } from "@/components/motion/HeroCanvas";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { ScrollPan } from "@/components/motion/ScrollPan";
import { StoredImage } from "@/components/media/StoredImage";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { listCatalogue } from "@/lib/content/catalogue";
import { cn } from "@/lib/utils/cn";
import { listTeam } from "@/lib/content/team";
import { listTestimonials } from "@/lib/content/testimonials";

export const metadata: Metadata = {
  title: "Tony Klinger — Film producer, author and coach",
  description:
    "Six decades in film and television. Courses, coaching, cohorts and retreats for filmmakers, writers and producers.",
};

const offers = [
  {
    title: "Membership",
    href: "/coaching/memberships",
    description:
      "Silver through Ultimate. Each tier includes everything below it, and adds more.",
    meta: "From £15 / month",
  },
  {
    title: "Courses",
    href: "/coaching/courses",
    description: "Structured, self-paced learning delivered in the Academy.",
    meta: "Self-paced",
  },
  {
    title: "Group Coaching",
    href: "/coaching/group-coaching",
    description:
      "Four series, eight sessions each, up to eight people in a session.",
    meta: "32 sessions",
  },
  {
    title: "Interactive Cohorts",
    href: "/coaching/cohorts",
    description: "Eight workshops of three hours — twenty-four hours together.",
    meta: "24 hours",
  },
  {
    title: "Private Coaching",
    href: "/coaching/private-coaching",
    description: "One to one, scheduled around you.",
    meta: "One to one",
  },
  {
    title: "Retreats",
    href: "/coaching/retreats",
    description: "Immersive, limited-place experiences.",
    meta: "Limited places",
  },
];

export default async function HomePage() {
  // Fetched together: three independent reads on one page should not be three
  // sequential waits.
  const [testimonials, team, works] = await Promise.all([
    listTestimonials({ featuredOnly: true, limit: 3 }),
    listTeam(),
    listCatalogue(),
  ]);

  const tony = team.find((m) => m.slug === "tony-klinger");
  // Only works that actually have a cover: a "featured work" strip of empty
  // frames is worse than no strip.
  // A horizontal pan can carry far more than a grid row, so the strip shows
  // the catalogue properly rather than a token four.
  const featuredWorks = works.filter((w) => w.storage_path).slice(0, 14);

  return (
    <>
      {/*
        HERO — a full colour field, not a card grid (note 01 §22).

        The canvas sits behind the type as decoration and is aria-hidden; the
        hero is designed to read correctly with no canvas at all, which is what
        happens under reduced-motion or without WebGL.
      */}
      <section className="grain relative isolate overflow-hidden bg-block-teal text-block-foreground">
        <HeroCanvas className="absolute inset-0 -z-10 h-full w-full opacity-70" />

        {/* Keeps the type legible over the brightest part of the canvas. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-block-teal via-block-teal/85 to-transparent"
        />

        <Container className="relative py-20 sm:py-28 lg:py-36">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <Reveal
                as="p"
                className="text-xs font-semibold tracking-[0.2em] text-block-foreground/75 uppercase"
              >
                Film &middot; Writing &middot; Producing
              </Reveal>

              <Reveal
                as="h1"
                delay={80}
                className="mt-5 font-display text-[2.75rem] leading-[1.02] font-semibold text-balance sm:text-6xl lg:text-7xl"
              >
                Six decades in the industry, taught in the open.
              </Reveal>

              <Reveal
                as="p"
                delay={160}
                className="mt-6 max-w-xl text-lg leading-relaxed text-block-foreground/85 text-pretty"
              >
                Tony Klinger is a multi-award-winning filmmaker who first worked
                on <em>The Avengers</em> and has since made over a hundred films
                worldwide, including <em>The Kids Are Alright</em>. He has worked
                with Michael Caine, The Who, Roger Moore, Deep Purple, Lee Marvin
                and Mickey Rooney, among many others. The coaching programme
                passes that experience on directly.
              </Reveal>

              <Reveal delay={240} className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/coaching" size="lg">
                  Explore coaching
                </ButtonLink>
                <ButtonLink href="/catalogue" size="lg" variant="onBlockOutline">
                  Browse the catalogue
                </ButtonLink>
              </Reveal>
            </div>

            {tony?.storage_path ? (
              <Parallax speed={0.06} className="hidden lg:block">
                <StoredImage
                  path={tony.storage_path}
                  alt="Tony Klinger"
                  width={800}
                  height={1000}
                  priority
                  quality={90}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="aspect-4/5 w-full rounded-(--radius-lg) object-cover shadow-lift"
                />
              </Parallax>
            ) : null}
          </div>
        </Container>
      </section>

      {/* WAYS TO WORK TOGETHER — on the page ground, between two colour fields. */}
      <Section>
        <Container>
          <Reveal className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              Coaching
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              Ways to work together
            </h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              Every offer explains what you get, what it costs and how it is
              delivered before you buy.
            </p>
          </Reveal>

          {/*
            ASYMMETRIC ON PURPOSE. Six equal boxes says all six offers matter
            equally, which is neither true nor interesting to look at —
            membership is the anchor of the business and a course is an entry
            point. The lead spans two columns with a colour field and larger
            type; the rest sit quieter beneath it. Same components, different
            weights, so the page has a hierarchy instead of a grid.
          */}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer, i) => {
              const lead = i === 0;

              return (
                <Reveal
                  as="li"
                  key={offer.href}
                  delay={(i % 3) * 70}
                  className={cn(lead && "sm:col-span-2 lg:row-span-2")}
                >
                  <Link
                    href={offer.href}
                    className={cn(
                      "group flex h-full flex-col rounded-(--radius-lg) p-6 shadow-card",
                      "transition-[transform,box-shadow,border-color] duration-(--dur-base) ease-expo",
                      "hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none",
                      lead
                        ? "grain relative isolate justify-end overflow-hidden bg-block-oxblood text-block-foreground sm:p-8"
                        : "border border-border bg-surface text-foreground hover:border-primary/40",
                    )}
                  >
                    <p
                      className={cn(
                        "text-[0.6875rem] font-semibold tracking-[0.12em] uppercase",
                        lead ? "text-block-foreground/75" : "text-muted-foreground",
                      )}
                    >
                      {offer.meta}
                    </p>

                    <h3
                      className={cn(
                        "mt-2 font-display font-semibold",
                        lead
                          ? "text-3xl sm:text-4xl"
                          : "text-xl group-hover:text-primary",
                      )}
                    >
                      {offer.title}
                    </h3>

                    <p
                      className={cn(
                        "mt-2 leading-relaxed",
                        lead
                          ? "max-w-md text-block-foreground/85"
                          : "flex-1 text-sm text-muted-foreground",
                      )}
                    >
                      {offer.description}
                    </p>

                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-5 text-sm font-medium transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none",
                        lead ? "text-block-foreground" : "text-primary",
                      )}
                    >
                      &rarr;
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </Container>
      </Section>

      {/* THE WORK — a teal field so the artwork sits on colour, not on grey. */}
      {featuredWorks.length > 0 ? (
        <Band tone="indigo">
          <BandHeader
            eyebrow="The catalogue"
            title="Films, books and recordings"
            lead="A hundred films, a shelf of books, and six decades of conversations — the work itself, not a description of it."
          />

          {/*
            A panning strip rather than another grid of boxes. The catalogue is
            the one part of this site with real breadth, and a four-up grid
            makes fourteen works look like four; panning them past the reader
            shows the range and gives the page a moment that is not a card.
            It degrades to an ordinary scrollable row (see ScrollPan).
          */}
          <div className="mt-12">
            <ScrollPan>
              {featuredWorks.map((work) => (
                <div key={work.id} className="w-64 shrink-0 sm:w-72">
                  <WorkCard item={work} />
                </div>
              ))}
            </ScrollPan>
          </div>

          <div className="mt-10">
            <ButtonLink href="/catalogue" variant="onBlockOutline">
              See the whole catalogue
              <ButtonArrow />
            </ButtonLink>
          </div>
        </Band>
      ) : null}

      {testimonials.length > 0 ? (
        <Section>
          <Container>
            <Testimonials testimonials={testimonials} />
          </Container>
        </Section>
      ) : null}

      {/* CLOSING CALL — oxblood, the last field before the footer. */}
      <Band tone="oxblood" width="narrow">
        <div className="text-center">
          <BandHeader
            title="Start where it suits you"
            lead="Browsing is open to everyone. An account is only needed for what you buy — and every offer says what it includes, what it costs and how long it lasts before you pay for it."
            align="center"
          />
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/coaching/memberships" size="lg" variant="onBlock">
              Compare membership
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="onBlockOutline">
              Ask a question
            </ButtonLink>
          </div>
        </div>
      </Band>
    </>
  );
}
