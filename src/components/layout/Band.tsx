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
 * The block colours are fixed in both themes (see globals.css), so a
 * band looks the same whether the visitor is in light or dark mode. That is
 * deliberate — the bands are the site's constant identity, and the ground
 * around them is what changes.
 *
 * `--block-foreground` is near-white and validated against every block field at
 * 4.5:1 by `scripts/check-contrast.mjs`, so any band can host body copy
 * without a per-colour text rule.
 *
 * Bands are load-bearing for rhythm, so use them sparingly: two or three on a
 * page. A page where every section is a different saturated colour is not
 * bolder, it is louder, and the hierarchy disappears.
 */
export function Band({
  children,
  tone = "noir",
  className,
  width = "default",
  grain = true,
  spacing = "default",
  backdrop,
}: {
  children: ReactNode;
  /**
   * One field (owner's rules, 2026-09-24: fewer colours, and no teal at all).
   * Noir, shared with the home hero. Kept as a prop so a page states its
   * intent and a future field is a one-line addition. Oxblood and indigo
   * remain tokens only for the Account and Admin identity strips.
   */
  tone?: "noir";
  className?: string;
  width?: "default" | "wide" | "narrow";
  /**
   * Fine luminance noise over the field. A large area of perfectly flat colour
   * is the strongest visual tell of a generated design; a little grain makes it
   * read as a printed surface. Off for bands that carry photography.
   */
  grain?: boolean;
  /**
   * "roomy" for a page built as a few large statements (the home page), where
   * each field needs air above and below to read as its own section rather
   * than a stripe in a stack. "balanced" is three quarters of it, for pages
   * whose sections read as too far apart at roomy (home, testimonials).
   */
  spacing?: "default" | "roomy" | "balanced";
  /**
   * A full-bleed layer behind the content — a faint photograph, say. Placed
   * outside the Container so it spans the whole band; it should position
   * itself (`absolute inset-0 -z-10`) and stay quiet enough for body copy.
   */
  backdrop?: ReactNode;
}) {
  const tones = {
    noir: "bg-block-noir",
  } as const;

  return (
    <section
      className={cn(
        "relative isolate text-block-foreground",
        tones[tone],
        grain && "grain",
        backdrop != null && "overflow-hidden",
        className,
      )}
    >
      {backdrop}
      <Container
        width={width}
        className={cn(
          "relative z-10",
          spacing === "roomy"
            ? "py-24 sm:py-32 lg:py-40"
            : // Three quarters of roomy: the home page from section 4 on
              // (owner, 2026-09-26: the gaps there were a quarter too big).
              spacing === "balanced"
              ? "py-18 sm:py-24 lg:py-30"
              : "py-16 sm:py-24",
        )}
      >
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
      <h2 className="mt-3 font-display text-balance">
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
