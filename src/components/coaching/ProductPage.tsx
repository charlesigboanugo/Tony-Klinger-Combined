import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

/**
 * The coaching product detail page — note 07 §37.1, note 10.
 *
 * ONE FAMILY FOR EVERY PRODUCT PAGE (owner, 2026-09-26: "award winning, easy
 * to read, price must be visible"). Before this, course, cohort, series,
 * private-coaching and membership pages were each laid out by hand, and had
 * drifted: different headers, stat boxes of different sizes, the price in a
 * small box in a different place on each.
 *
 * The parts, in reading order:
 *
 *   ProductHero      the product's own cover, full bleed, darkened at its
 *                    foot, carrying the title, one line and THE PRICE as the
 *                    same red tag the listing card wears — so the page opens
 *                    on what was clicked
 *   ProductFacts     the shape of it (length, format, group size) as one quiet
 *                    row of labelled facts, not a grid of boxed numbers
 *   ProductLayout    a reading column beside a sticky purchase panel
 *   PurchasePanel    the price again, large, with the options and the button
 *   MobileBuyBar     on a phone, price and button pinned to the foot of the
 *                    screen, so the price is never more than a glance away
 */

export type HeroCover = {
  /** A storage path (product covers) … */
  path?: string | null;
  /** … or a design photo under /public. */
  src?: string;
  alt?: string;
  focus?: string;
};

export function ProductHero({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  cover,
  price,
  priceNote,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  cover: HeroCover;
  price?: string | null;
  priceNote?: string | null;
}) {
  const hasCover = Boolean(cover.path || cover.src);
  return (
    // Almost a full screen below the header (owner, 2026-09-26): 2rem is
    // left at the fold so the page visibly continues. Capped on very tall
    // screens so the cover is not stretched into a wall.
    // Without a photo (an event with no image yet) the height follows the
    // words instead: a near-full screen of empty noir reads as a fault.
    <section
      className={cn(
        "relative isolate overflow-hidden bg-block-noir text-block-foreground",
        hasCover ? "min-h-[min(calc(100svh-6rem),60rem)] lg:min-h-[min(calc(100svh-6.5rem),60rem)]" : "grain",
      )}
    >
      {hasCover ? null : (
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/3 -z-10 h-[160%] w-[min(70rem,160vw)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--block-foreground)_14%,transparent),transparent_62%)]"
        />
      )}
      <div className="absolute inset-0 -z-10">
        {cover.path ? (
          <StoredImage path={cover.path} alt="" fill priority quality={90} sizes="100vw" className={cover.focus} />
        ) : cover.src ? (
          <Image
            src={cover.src}
            alt=""
            fill
            priority
            quality={90}
            sizes="100vw"
            className={cn("object-cover", cover.focus)}
          />
        ) : null}
      </div>
      {/* Darkest at the top, where the words now sit. */}
      {hasCover ? (
        <>
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-block-noir/85 via-block-noir/60 to-block-noir/30" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-block-noir/60 via-transparent to-transparent" />
        </>
      ) : null}

      {/*
        The EYEBROW starts at the height every page's hero text starts at
        (`--hero-text-top` below the header, note 10), not at the foot of the
        photo (owner, 2026-09-26). The back link keeps its place above it
        (3.5rem up from --hero-text-top), and the words then sit a step lower
        than that line, so the eyebrow ("Level Two"…) does not crowd the link
        (owner, same day). Below `lg` pages start their words just under the
        header, and so does this.

        The back link is a pill, not a quiet text link: the owner found it
        too small and too faint over the photo.
      */}
      <Container className="pt-6 pb-14 sm:pb-18 lg:pb-20 lg:pt-[max(1.5rem,calc(var(--hero-text-top)-3.5rem))]">
        <Link
          href={backHref}
          className="group inline-flex items-center gap-2.5 rounded-full border border-block-foreground/35 bg-block-noir/45 py-2 pr-4.5 pl-3.5 text-[0.9375rem] font-medium text-block-foreground backdrop-blur-sm transition-colors hover:border-block-foreground/70 hover:bg-block-noir/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span
            aria-hidden="true"
            className="text-xl leading-none transition-transform duration-(--dur-base) group-hover:-translate-x-0.5 motion-reduce:transition-none"
          >
            &larr;
          </span>
          {backLabel}
        </Link>

        <Reveal className="mt-10 max-w-3xl lg:mt-16">
          {eyebrow ? (
            <p className="flex items-center gap-4 text-xs font-semibold tracking-[0.2em] text-block-foreground/75 uppercase">
              <span aria-hidden="true" className="h-px w-10 bg-primary" />
              {eyebrow}
            </p>
          ) : null}
          {/* One h1 size site-wide (note 10); long product names wrap. */}
          <h1 className="mt-5 text-balance">{title}</h1>
          {description ? (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-block-foreground/85 text-pretty sm:text-xl">
              {description}
            </p>
          ) : null}
          {price ? (
            <p className="mt-8 inline-flex items-baseline gap-2 rounded-full bg-button px-6 py-3 text-button-foreground shadow-lift ring-1 ring-white/20">
              <span className="font-display text-3xl leading-none font-semibold tabular-nums">{price}</span>
              {priceNote ? <span className="text-sm font-medium opacity-85">{priceNote}</span> : null}
            </p>
          ) : null}
        </Reveal>
      </Container>
    </section>
  );
}

/** The shape of the offer, as one row of labelled facts. */
export function ProductFacts({ facts }: { facts: { label: string; value: string }[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-7 md:grid-cols-[repeat(3,minmax(0,max-content))] md:gap-x-10">
      {facts.map((f) => (
        <div key={f.label}>
          {/* The label steps back so the value leads (owner, 2026-09-26): regular
              weight, not the semibold small caps it had. (Full muted grey: at 75%
              it fell to 3.7:1 on the ivory ground.) */}
          <dt className="text-[0.6875rem] font-normal tracking-[0.14em] text-muted-foreground uppercase">{f.label}</dt>
          <dd className="mt-1.5 text-lg font-semibold">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A reading column and a purchase panel that stays in view beside it. */
export function ProductLayout({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <Container className="py-14 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        <div className="min-w-0 space-y-14">{children}</div>
        <aside id="buy" className="scroll-mt-28 lg:sticky lg:top-28 lg:self-start">
          {aside}
        </aside>
      </div>
    </Container>
  );
}

/** A titled block in the reading column. */
export function ProductSection({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-balance">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Included items, each ticked — the same mark as the membership cards. */
export function CheckList({ items, columns = 1 }: { items: string[]; columns?: 1 | 2 }) {
  return (
    <ul className={cn("grid gap-x-10 gap-y-3.5", columns === 2 && "sm:grid-cols-2")}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed">
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/12 text-accent"
          >
            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5 6.5 11.5 12.5 5" />
            </svg>
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The purchase panel: the price large, then whatever buys it. */
export function PurchasePanel({
  price,
  priceNote,
  children,
  footnote,
}: {
  price?: string | null;
  priceNote?: string | null;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-lift">
      <div className="p-7">
        {price ? (
          <p className="flex items-baseline gap-2">
            <span className="font-display text-5xl leading-none font-semibold tabular-nums">{price}</span>
            {priceNote ? <span className="text-sm text-muted-foreground">{priceNote}</span> : null}
          </p>
        ) : null}
        <div className={cn(price && "mt-6")}>{children}</div>
      </div>
      {footnote ? (
        <div className="border-t border-border bg-surface-muted/60 px-7 py-5 text-sm leading-relaxed text-muted-foreground">
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Price and the next step, pinned to the foot of a phone screen. Hidden from
 * `lg`, where the purchase panel is sticky beside the reading column instead.
 * A spacer the bar's height is rendered with it, so it never covers the last
 * of the page's content.
 */
export function MobileBuyBar({
  price,
  priceNote,
  href,
  label,
}: {
  price?: string | null;
  priceNote?: string | null;
  href: string;
  label: string;
}) {
  return (
    <>
      <div aria-hidden="true" className="h-20 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/98 px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          {price ? (
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl leading-none font-semibold tabular-nums">{price}</span>
              {priceNote ? <span className="text-xs text-muted-foreground">{priceNote}</span> : null}
            </p>
          ) : (
            <span />
          )}
          <Link
            href={href}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-button px-6 text-[0.9375rem] font-semibold text-button-foreground shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {label}
          </Link>
        </div>
      </div>
    </>
  );
}
