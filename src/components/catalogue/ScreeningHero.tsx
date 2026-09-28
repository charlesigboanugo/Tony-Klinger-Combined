import type { CSSProperties, ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { StoredImage } from "@/components/media/StoredImage";
import { cn } from "@/lib/utils/cn";

/**
 * The opening frame of a catalogue collection and of a single work — note 10
 * §42.1.
 *
 * A PREMIERE STAGE, CENTRED. A grained noir field lit two ways: the work's own
 * artwork blurred into coloured light that drifts into place as the page
 * opens, and a pale spotlight falling from the top onto the words. Then the
 * eyebrow, the one h1, the lede and anything else the page puts in front
 * (links, a player) — and beneath them the STAGE: the posters dealt into a fan, or the work's own
 * artwork, hanging over the field's lower edge into the page.
 *
 * Not words-beside-a-picture: the owner rejects the split (2026-09-25).
 *
 * All motion is an entrance — nothing moves for longer than a few seconds, so
 * there is nothing to pause — and every animation is transform or opacity, so
 * it stays on the compositor. Reduced motion shows the finished frame.
 *
 * The backdrop artwork is fetched at 64px — the blur destroys detail anyway —
 * so a six-cover backdrop costs a few kilobytes. It is decoration: empty alt,
 * aria-hidden. Ink (`secondary`) is dark in both themes.
 */
export function ScreeningHero({
  eyebrow,
  title,
  lede,
  backdrop = [],
  children,
  stage,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Artwork paths to blur into light. Up to six are used. */
  backdrop?: string[];
  /** Further content under the lede: links, a player. */
  children?: ReactNode;
  /** What hangs beneath the words and over the field's edge: a fan, a poster. */
  stage?: ReactNode;
  className?: string;
}) {
  const glow = backdrop.slice(0, 6);

  return (
    <>
      <section
        className={cn(
          "grain relative isolate overflow-hidden bg-secondary text-center text-secondary-foreground",
          className,
        )}
      >
        {glow.length > 0 ? (
          <div
            aria-hidden="true"
            className="absolute inset-[-15%] -z-30 grid animate-[leak-drift_2.6s_var(--ease-out-expo)_reverse_both] grid-cols-3 opacity-70 motion-reduce:animate-none"
          >
            {glow.map((path, i) => (
              <div key={path} className={cn("relative", glow.length === 1 && "col-start-2", i % 2 === 1 && "translate-y-1/4")}>
                <StoredImage path={path} alt="" fill sizes="64px" loading="eager" className="scale-150 blur-[80px] saturate-150" />
              </div>
            ))}
          </div>
        ) : null}

        {/* The spotlight: a pale cone from above the title, fading to the
            ink at the sides, so the middle of the stage is always the
            brightest place on it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_45%_70%_at_50%_-10%,color-mix(in_oklab,white_14%,transparent)_0%,transparent_70%)]"
        />
        {/* Pull the light down into the ink, so type always sits on dark and
            the hanging stage meets the page on an unbroken edge. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_90%_75%_at_50%_45%,transparent_0%,color-mix(in_oklab,var(--secondary)_70%,transparent)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-20 h-1/2 bg-linear-to-t from-secondary to-transparent"
        />

        <Container
          width="narrow"
          className={cn(
            "flex flex-col items-center pt-16 sm:pt-24 lg:pt-(--hero-text-top)",
            stage ? "pb-48 sm:pb-64" : "pb-20 sm:pb-28",
          )}
        >
          {eyebrow ? (
            <div className="mb-6 flex animate-[fade-up_0.9s_var(--ease-out-expo)_both] items-center gap-4 text-xs font-semibold tracking-[0.32em] text-secondary-foreground/70 uppercase motion-reduce:animate-none">
              <span aria-hidden="true" className="h-px w-10 bg-secondary-foreground/40" />
              {eyebrow}
              <span aria-hidden="true" className="h-px w-10 bg-secondary-foreground/40" />
            </div>
          ) : null}
          <h1 className="overflow-hidden pb-[0.1em] font-display text-balance">
            <span className="block animate-[line-rise_1.1s_var(--ease-out-expo)_both] [animation-delay:120ms] motion-reduce:animate-none">
              {title}
            </span>
          </h1>
          {lede ? (
            <p className="mt-6 max-w-2xl animate-[fade-up_0.9s_var(--ease-out-expo)_both] text-lg leading-relaxed text-pretty text-secondary-foreground/80 [animation-delay:360ms] motion-reduce:animate-none sm:text-xl">
              {lede}
            </p>
          ) : null}
          {children ? (
            <div className="flex w-full animate-[fade-up_0.9s_var(--ease-out-expo)_both] flex-col items-center [animation-delay:480ms] motion-reduce:animate-none">
              {children}
            </div>
          ) : null}
        </Container>
      </section>

      {stage ? <div className="relative z-10 -mt-36 sm:-mt-48">{stage}</div> : null}
    </>
  );
}

/** Where each card of the fan comes to rest, from the left: turn and lift. */
const REST = [
  { turn: -14, x: -6, y: 34 },
  { turn: -7, x: -3, y: 10 },
  { turn: 0, x: 0, y: 0 },
  { turn: 7, x: 3, y: 10 },
  { turn: 14, x: 6, y: 34 },
];
/** How far each card slides outward when the fan is hovered, as a share of its width. */
const SPREAD = ["group-hover:-translate-x-[28%]", "group-hover:-translate-x-[12%]", "group-hover:-translate-y-3", "group-hover:translate-x-[12%]", "group-hover:translate-x-[28%]"];

/**
 * The slate, dealt: up to five posters that rise from one stack into a fan as
 * the page opens, one after another, and spread wider under the pointer. The
 * middle card is largest and in front. Purely decorative — the same works
 * are listed, with their titles, below — so it is aria-hidden.
 *
 * The rest position lives in the `deal` keyframe's end state (through custom
 * properties) and the hover spread on an inner element, because an
 * animation's filled transform would otherwise override the hover one.
 */
export function PosterFan({ paths }: { paths: string[] }) {
  const fan = paths.slice(0, 5);
  const offset = (5 - fan.length) >> 1;

  return (
    <div aria-hidden="true" className="group relative mx-auto flex h-52 max-w-3xl items-start justify-center sm:h-80">
      {fan.map((path, i) => {
        const slot = i + offset;
        const rest = REST[slot];
        const middle = slot === 2;
        return (
          <div
            key={path}
            className={cn(
              "relative -mx-7 shrink-0 origin-bottom animate-[deal_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none sm:-mx-10",
              middle ? "z-10 w-36 sm:w-52" : "w-28 sm:w-44",
              (slot === 1 || slot === 3) && "z-5",
              // A phone has room for three; the outer pair joins from `sm`.
              (slot === 0 || slot === 4) && "hidden sm:block",
            )}
            style={
              {
                "--deal-to": `translate(${rest.x}%, ${rest.y}px) rotate(${rest.turn}deg)`,
                animationDelay: `${420 + Math.abs(slot - 2) * 140}ms`,
                transform: "var(--deal-to)",
              } as CSSProperties
            }
          >
            <div
              className={cn(
                "relative aspect-3/4 overflow-hidden rounded-sm shadow-2xl ring-1 ring-white/10",
                "transition-transform duration-(--dur-slow) ease-expo motion-reduce:transition-none",
                SPREAD[slot],
              )}
            >
              <StoredImage path={path} alt="" fill sizes="(min-width: 640px) 208px, 144px" quality={90} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
