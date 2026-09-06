import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils/cn";

/**
 * A full-bleed jewel block — note 10 §5, §11.
 *
 * This is the structural device the design is built on. A page is not a stack
 * of cards on one background; it is a sequence of full-width colour fields,
 * and the colour is how you tell one section from the next while scrolling.
 *
 * The three block colours are fixed in both themes (see globals.css), so a
 * band looks the same whether the visitor is in light or dark mode. That is
 * deliberate — the bands are the site's constant identity, and the ground
 * around them is what changes.
 *
 * `--block-foreground` is near-white and validated against all three fields at
 * 4.5:1 by `scripts/check-contrast.mjs`, so any band can host body copy
 * without a per-colour text rule.
 *
 * Bands are load-bearing for rhythm, so use them sparingly: two or three on a
 * page. A page where every section is a different saturated colour is not
 * bolder, it is louder, and the hierarchy disappears.
 */
export function Band({
  children,
  tone = "indigo",
  className,
  width = "default",
  grain = true,
}: {
  children: ReactNode;
  tone?: "oxblood" | "teal" | "indigo";
  className?: string;
  width?: "default" | "wide" | "narrow";
  /**
   * Fine luminance noise over the field. A large area of perfectly flat colour
   * is the strongest visual tell of a generated design; a little grain makes it
   * read as a printed surface. Off for bands that carry photography.
   */
  grain?: boolean;
}) {
  const tones = {
    oxblood: "bg-block-oxblood",
    teal: "bg-block-teal",
    indigo: "bg-block-indigo",
  } as const;

  return (
    <section
      className={cn(
        "relative isolate text-block-foreground",
        tones[tone],
        grain && "grain",
        className,
      )}
    >
      <Container width={width} className="relative z-10 py-16 sm:py-24">
        {children}
      </Container>
    </section>
  );
}

/**
 * Heading + lead for use inside a band.
 *
 * Separate from PageHeader because a band's type sits on saturated colour
 * rather than on the page ground: the lead is held at a higher opacity than
 * `muted-foreground` would give, which would be unreadable here.
 */
export function BandHeader({
  eyebrow,
  title,
  lead,
  align = "start",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "start" | "center";
}) {
  const centered = align === "center";

  return (
    <div className={cn("max-w-3xl", centered && "mx-auto text-center")}>
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.18em] text-block-foreground/70 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 font-display text-3xl leading-[1.1] font-semibold text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-lg leading-relaxed text-block-foreground/85 text-pretty">
          {lead}
        </p>
      ) : null}
    </div>
  );
}
