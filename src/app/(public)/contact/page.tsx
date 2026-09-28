import type { Metadata } from "next";
import Image from "next/image";

import { ContactForm } from "@/app/(public)/contact/ContactForm";
import { NewsletterCta } from "@/components/content/NewsletterPopup";
import { Container } from "@/components/layout/Container";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { designPhotos } from "@/lib/site/design-photos";
import { socialLinks, substack, type ChannelLink } from "@/lib/site/links";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write to Tony Klinger about coaching, talks and events, press, or anything else.",
};

const eyebrow = "text-xs font-semibold tracking-[0.2em] uppercase";

/** Left padding for the hero's words, on the default content column. */
const inset = "px-4 sm:px-6 lg:pr-0 lg:pl-[max(2rem,calc((100vw-76rem)/2+2rem))]";

/** The address each channel shows, read from its URL rather than typed twice. */
function addressOf(link: ChannelLink) {
  const url = new URL(link.href);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname}`.replace(/\/$/, "");
}

/**
 * Contact — note 03 §8, note 10 §42.3.
 *
 * Three movements: a noir title card with the cap portrait dissolved into the
 * field; the form in one centred card; and Tony's channels as an editorial
 * index.
 */
export default function ContactPage() {
  const channels = [...(substack ? [substack] : []), ...socialLinks];

  return (
    <>
      {/* TITLE CARD — the photo is masked into noir, as on the About hero;
          words on the field to the left, starting at the shared hero height. */}
      <section className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground lg:flex lg:min-h-[calc(88svh-4.5rem)] lg:flex-col">
        <figure
          className={cn(
            "relative -z-10 aspect-4/3 w-full",
            "mask-[linear-gradient(to_bottom,black_50%,transparent_95%)]",
            "lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[62%]",
            "lg:mask-[radial-gradient(ellipse_78%_105%_at_66%_30%,black_40%,transparent_76%),linear-gradient(to_bottom,black_60%,transparent_96%)] lg:mask-intersect",
          )}
        >
          <div className="absolute inset-0 animate-[settle_2.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
            <Image
              src={designPhotos.contact.src}
              alt={designPhotos.contact.alt}
              fill
              priority
              quality={90}
              sizes="(min-width: 1024px) 62vw, 100vw"
              className={cn("object-cover", designPhotos.contact.focus)}
            />
          </div>
        </figure>
        {/* Outside the figure: its mask would fade the credit away. */}
        <PhotoCredit src={designPhotos.contact.src} variant="overlay" />

        <div className="-mt-14 sm:-mt-24 lg:mt-0 lg:flex lg:flex-1">
          <div className={cn(inset, "relative pb-16 sm:pb-20 lg:w-[58%] lg:pt-(--hero-text-top) lg:pb-24 lg:pr-12")}>
            <p
              className={cn(
                eyebrow,
                "flex items-center gap-4 text-block-foreground/75",
                "animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none",
              )}
              style={{ animationDelay: "150ms" }}
            >
              <span aria-hidden="true" className="h-px w-10 bg-primary" />
              Contact
            </p>
            <h1 className="mt-5 overflow-hidden pb-[0.1em]">
              <span
                className="block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
                style={{ animationDelay: "250ms" }}
              >
                Let&apos;s talk.
              </span>
            </h1>
            <p
              className="mt-6 max-w-2xl font-normal text-xl leading-snug text-balance animate-[fade-up_0.9s_var(--ease-out-expo)_both] sm:text-2xl lg:text-[1.625rem] lg:leading-[1.3] motion-reduce:animate-none"
              style={{ animationDelay: "500ms" }}
            >
              Coaching, talks, press or a project.{" "}
              <em className="text-block-foreground/75">Write, and the studio replies.</em>
            </p>
            <div
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
              style={{ animationDelay: "650ms" }}
            >
              <ButtonLink href="#write" size="lg" variant="onBlock" className="group/btn">
                Write a message
                <ButtonArrow />
              </ButtonLink>
              <p className="text-sm text-block-foreground/70">
                Replies usually within a few working days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE FORM — one centred card. */}
      <section aria-labelledby="write-heading" className="py-20 sm:py-28">
        <Container>
          {/* The jump target is the card, not the section, so "Write a
              message" lands with a little space above the form. */}
          <div id="write" className="scroll-mt-32">
            <ContactForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          </div>
        </Container>
      </section>

      {/* ELSEWHERE — the channels as an index, each row a link out. */}
      <section aria-labelledby="elsewhere-heading" className="border-t border-border bg-surface-muted/60 py-20 sm:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>Elsewhere</Eyebrow>
              <h2 id="elsewhere-heading" className="mt-5">
                Follow the work.
              </h2>
              <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
                Talks, clips and notes from set, wherever you already read and
                watch. Or have Tony&apos;s letters sent straight to you.
              </p>
              <div className="mt-8">
                <NewsletterCta />
              </div>
            </Reveal>

            <ul className="border-t border-foreground/15">
              {channels.map((l, i) => (
                <Reveal as="li" key={l.href} delay={i * 60}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-5 border-b border-foreground/15 py-6 sm:gap-8 sm:py-7"
                  >
                    {/* A red rule draws across the row on hover. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-px h-px origin-left scale-x-0 bg-primary transition-transform duration-(--dur-slow) ease-expo group-hover:scale-x-100 motion-reduce:transition-none"
                    />
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground transition-[color,border-color,transform] duration-(--dur-base) ease-expo group-hover:scale-105 group-hover:border-primary group-hover:text-primary motion-reduce:transform-none sm:size-14">
                      <ChannelIcon label={l.label} className="sm:size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[clamp(1.75rem,1.25rem+1.5vw,2.75rem)] leading-tight font-semibold transition-colors duration-(--dur-base) group-hover:text-primary">
                        {l.label}
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {addressOf(l)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-2xl text-muted-foreground transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-primary motion-reduce:transform-none"
                    >
                      &#8599;
                    </span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </Reveal>
              ))}
            </ul>
          </div>
        </Container>
      </section>
    </>
  );
}
