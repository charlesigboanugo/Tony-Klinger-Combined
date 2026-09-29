import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { Band } from "@/components/layout/Band";
import { Container } from "@/components/layout/Container";
import { TestimonialVideos } from "@/components/content/TestimonialVideos";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listTestimonialVideos } from "@/lib/content/testimonial-videos";
import { listTestimonials } from "@/lib/content/testimonials";
import { designPhotos } from "@/lib/site/design-photos";
import { Eyebrow } from "@/components/ui/Eyebrow";

import { FilteredWall, TestimonialWall } from "./TestimonialWall";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "What people who have worked with Tony Klinger say about the coaching, the courses and the talks.",
};

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
 * because the slider already shows every voice. `?about=` narrows by context,
 * applied in the browser so the page can be pre-built (note 10 §47.1); "All"
 * never filters, because a visitor looking for proof should be able to see
 * every word of it.
 */
export default async function TestimonialsPage() {
  const [all, videos] = await Promise.all([listTestimonials(), listTestimonialVideos()]);

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
      <section className="grain relative isolate flex h-[min(calc(100svh-6rem),60rem)] min-h-144 flex-col justify-end overflow-hidden bg-block-noir text-block-foreground lg:h-[min(calc(100svh-6.5rem),60rem)]">
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
              fetchPriority="high"
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
        <section aria-labelledby="voices-heading" className="py-18 sm:py-24">
          <Container>
            <Suspense fallback={<TestimonialWall all={all} />}>
              <FilteredWall all={all} />
            </Suspense>
          </Container>
        </section>
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
