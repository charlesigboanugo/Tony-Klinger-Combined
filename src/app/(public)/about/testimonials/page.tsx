import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Band } from "@/components/layout/Band";
import { Container } from "@/components/layout/Container";
import { Carousel } from "@/components/motion/Carousel";
import { TestimonialVideos } from "@/components/content/TestimonialVideos";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listTestimonialVideos } from "@/lib/content/testimonial-videos";
import { listTestimonials, type Testimonial } from "@/lib/content/testimonials";
import { designPhotos } from "@/lib/site/design-photos";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "What people who have worked with Tony Klinger say about the coaching, the courses and the talks.",
};

/** How each `context` reads to a visitor. A context not listed is shown under "All" only. */
const FILTERS: { key: string; label: string }[] = [
  { key: "coaching", label: "Coaching" },
  { key: "courses", label: "Courses" },
  { key: "general", label: "Talks and press" },
];

/**
 * Testimonials — note 03 §5.
 *
 * THE FULL SET, and the only place that shows it. The home page and the
 * coaching storefront each render a short selection through the shared
 * `Testimonials` component; this page is where "see all" leads, and it reads
 * the same table (note 03 §37).
 *
 * Set as an editorial page (owner, 2026-09-24): a full-screen screening-room
 * header, then every quote on one slider, each quote's type sized to its
 * length. There is no separate lead quote: the owner removed it (2026-09-26)
 * because the slider already shows every voice. `?about=` narrows by context with plain links — no client JS —
 * and "All" never filters, because a visitor looking for proof should be able
 * to see every word of it.
 */
export default async function TestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ about?: string }>;
}) {
  const { about } = await searchParams;
  const [all, videos] = await Promise.all([listTestimonials(), listTestimonialVideos()]);
  const active = FILTERS.some((f) => f.key === about) ? about : undefined;

  // Voices signed by name and survey voices alternate, so the columns mix
  // the two rather than stacking every named voice at the top.
  const matching = all.filter((t) => !active || t.context === active);
  const signed = matching.filter((t) => t.attributed_to);
  const unsigned = matching.filter((t) => !t.attributed_to);
  const rest = Array.from({ length: Math.max(signed.length, unsigned.length) }).flatMap((_, n) =>
    [signed[n], unsigned[n]].filter((t): t is Testimonial => Boolean(t)),
  );

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.key, all.filter((t) => t.context === f.key).length]),
  );

  return (
    <>
      {/*
        HEADER — a screening room, the whole screen below the masthead (owner,
        2026-09-26: stretch it out, and a larger photo). Noir, with grain.

        The Tyneside Cinema Q&A runs the full height of the header, centred,
        its sides dissolving into the dark; a blurred copy of it fills the
        width behind, like the light of a projector in the room. A plain
        full-width crop was ruled out: the photo is 3:4, and a landscape crop
        cuts either the screen's title or the two men on stage. On a phone
        the photo is wider than the screen and simply fills it.

        The words sit on the photo's own dark foot (the heads in the stalls),
        centred. The cinema's name is in the photo itself, so there is no
        venue tag, and split heroes are out.
      */}
      <section className="grain relative isolate flex h-[min(calc(100svh-6rem),60rem)] min-h-[36rem] flex-col justify-end overflow-hidden bg-block-noir text-block-foreground lg:h-[min(calc(100svh-6.5rem),60rem)]">
        {/* The room's light: the same photo, small, blurred and dim. */}
        <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-45">
          <Image
            src={designPhotos.testimonials.src}
            alt=""
            fill
            quality={75}
            sizes="20vw"
            className="scale-110 object-cover blur-2xl"
          />
        </div>

        <figure className="absolute inset-y-0 left-1/2 -z-10 aspect-3/4 h-full max-w-none -translate-x-1/2">
          <div className="relative size-full animate-[settle_2.6s_var(--ease-out-expo)_both] mask-[linear-gradient(to_right,transparent,black_16%,black_84%,transparent)] motion-reduce:animate-none">
            <Image
              src={designPhotos.testimonials.src}
              alt={designPhotos.testimonials.alt}
              fill
              priority
              quality={90}
              sizes="(min-width: 640px) 48rem, 100vw"
              className="object-cover"
            />
          </div>
        </figure>

        {/* Deepens the stalls under the words. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-3/5 bg-linear-to-t from-block-noir via-block-noir/70 to-transparent" />

        <Container className="pb-12 text-center sm:pb-16 lg:pb-20">
          <Reveal className="mx-auto max-w-2xl">
            <Eyebrow align="center" className="text-block-foreground/80">In their own words</Eyebrow>
            <h1 className="mt-5">Testimonials</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-block-foreground/85 text-pretty">
              From writers, filmmakers and producers who have sat in the room,
              taken the courses and come to the talks. Unedited, and all of
              them here.
            </p>
          </Reveal>
        </Container>
      </section>

      {all.length === 0 ? (
        <Container className="py-16">
          <EmptyState
            title="No testimonials published yet"
            description="They will appear here as they are published."
            action={
              <ButtonLink href="/coaching" variant="outline">
                See the coaching
              </ButtonLink>
            }
          />
        </Container>
      ) : (
        <>
          {/*
            EVERY VOICE — the full set as a wall. Filters are a tab bar with
            counts (plain links, no client JS). Voices signed by name are set
            larger on the paper tone; survey voices stay open on a hairline,
            so the wall has a rhythm rather than eleven identical items. Each
            carries a monogram and what it is about.
          */}
          <section aria-labelledby="voices-heading" className="py-18 sm:py-24">
            <Container>
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <Eyebrow>{rest.length}{" "}
                    {rest.length === 1 ? "voice" : "voices"}
                    {active ? ` · ${FILTERS.find((f) => f.key === active)?.label}` : null}</Eyebrow>
                  <h2 id="voices-heading" className="mt-4 scroll-mt-28 font-display">Every voice</h2>
                </div>
                <nav aria-label="Filter testimonials" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <ul className="flex min-w-max gap-6 border-b border-foreground/15 sm:gap-8">
                    {[{ key: undefined, label: "All" }, ...FILTERS].map((f) => {
                      const current = f.key === active;
                      const count = f.key ? counts[f.key] : all.length;
                      if (f.key && !count) return null;
                      return (
                        <li key={f.label}>
                          <Link
                            href={f.key ? `/about/testimonials?about=${f.key}#voices-heading` : "/about/testimonials#voices-heading"}
                            scroll={false}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "-mb-px inline-flex items-baseline gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
                              current
                                ? "border-accent text-foreground"
                                : "border-transparent text-muted-foreground hover:border-accent/50 hover:text-accent",
                            )}
                          >
                            {f.label}
                            <sup className={cn("text-[0.6875rem] tabular-nums", current ? "text-accent" : "text-muted-foreground")}>
                              {count}
                            </sup>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>

              {/* Two at a time from md, one on a phone, sliding on the shared
                  Carousel (owner, 2026-09-26: the three-column wall was too
                  clustered). The filter tabs above still narrow the set. */}
              <Reveal>
                <Carousel
                  label="Written testimonials"
                  interval={7000}
                  className="mt-14"
                  trackClassName="-mx-4"
                  slideClassName="w-full px-4 md:w-1/2"
                >
                  {rest.map((t) => (
                    <Quote key={t.id} testimonial={t} />
                  ))}
                </Carousel>
              </Reveal>
            </Container>
          </section>
        </>
      )}

      {/*
        ON CAMERA — the filmed testimonials from the coaching site, on noir
        like a screening room. Outside the written wall's empty state: a
        page with films and no quotes should still show the films.
      */}
      {videos.length > 0 ? (
        <Band tone="noir" spacing="balanced">
          <section aria-labelledby="on-camera-heading">
            <Eyebrow>On camera</Eyebrow>
            <h2 id="on-camera-heading" className="mt-5 font-display">
              Said to camera.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-block-foreground/75">
              Clients of the coaching, in their own time and their own rooms,
              on what the sessions did for them.
            </p>
            <TestimonialVideos videos={videos} />
          </section>
        </Band>
      ) : null}

      {/* CLOSE — the next step, on the paper tone. */}
      <section className="border-t border-border bg-surface-muted py-15 sm:py-21">
        <Container className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h2 className="font-display">Hear it for yourself.</h2>
            <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
              Start with a group session, a course or one hour one to one.
              Every option says what you get before you pay.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/coaching" size="lg">
              See the coaching
              <ButtonArrow />
            </ButtonLink>
            <ButtonLink href="/about" size="lg" variant="outline">
              Tony&apos;s story
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

/** How a `context` is named on a quote. */
const CONTEXT_LABEL: Record<string, string> = Object.fromEntries(FILTERS.map((f) => [f.key, f.label]));

/** "Francesca Lilleystone" → "FL". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * One voice on the wall. Type steps down as the quote grows, so a short
 * remark is set like a headline and a paragraph like a letter. A voice
 * signed by name sits on the paper tone, a step larger; a survey voice stays
 * open on a hairline. The monogram is the person's initials, or a quote mark
 * for an anonymous voice.
 */
function Quote({ testimonial: t }: { testimonial: Testimonial }) {
  const named = Boolean(t.attributed_to);
  const size =
    t.quote.length < 90
      ? named ? "text-2xl leading-snug" : "text-xl leading-snug"
      : t.quote.length < 200
        ? named ? "text-xl leading-snug" : "text-lg leading-snug"
        : named ? "text-lg leading-relaxed" : "text-base leading-relaxed";
  const about = t.context ? CONTEXT_LABEL[t.context] : undefined;

  return (
    <figure
      className={cn(
        "flex h-full flex-col rounded-sm p-7 sm:p-9",
        named ? "bg-surface-muted" : "border border-foreground/15",
      )}
    >
      {about ? (
        <p className="mb-4 flex items-center gap-3 text-[0.625rem] font-semibold tracking-[0.2em] text-current/70 uppercase"><span aria-hidden="true" className="h-px w-6 bg-primary" />{about}</p>
      ) : null}
      <blockquote className={cn("font-medium text-pretty", size)}>
        <span aria-hidden="true" className="mr-1 text-primary">&ldquo;</span>
        {t.quote}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-6">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
            named ? "bg-button text-button-foreground" : "border border-foreground/20 text-primary",
          )}
        >
          {named ? initials(t.attributed_to!) : <span className="text-xl leading-none">&ldquo;</span>}
        </span>
        <span className="min-w-0 text-sm leading-snug">
          {t.attributed_to ? <span className="block font-semibold">{t.attributed_to}</span> : null}
          {t.attribution_detail ? (
            <span className="block text-muted-foreground">{t.attribution_detail}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}
