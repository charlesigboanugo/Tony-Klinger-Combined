import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Card primitives — note 10 §27.
 *
 * Composable rather than one component with fifteen props, because a course
 * card, a book cover and a membership tier share a SURFACE but almost nothing
 * else about their content. One component trying to cover all three ends up
 * with a prop for every difference, which is how every card on a site drifts
 * into looking identical.
 *
 * The surface itself is deliberately quiet — a hairline border, a real
 * shadow, a small radius. The visual interest is meant to come from the
 * artwork inside, not from the frame around it.
 */

export function Card({
  className,
  interactive = false,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-(--radius-lg)",
        // `text-foreground` is NOT redundant with `bg-surface`.
        //
        // A card dropped inside a jewel Band inherits that band's
        // `--block-foreground`, which is near-white — so on the card's own
        // white surface the title rendered at 1.11:1 and was effectively
        // invisible in light mode. A card must state its own text colour
        // because it can be placed on any ground.
        "border border-border bg-surface text-foreground shadow-card",
        interactive &&
          "transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    />
  );
}

/**
 * Fixed-ratio media well.
 *
 * The ratio is set here rather than on the image so a card with no artwork
 * still occupies the same height as its neighbours — otherwise one missing
 * cover ragged-edges an entire grid. Twelve catalogue items genuinely have no
 * cover, so this is the normal case, not the exceptional one.
 */
export function CardMedia({
  children,
  ratio = "4/3",
  className,
}: {
  children?: ReactNode;
  ratio?: "4/3" | "3/4" | "16/9" | "1/1" | "2/3";
  className?: string;
}) {
  const ratios = {
    "4/3": "aspect-[4/3]",
    "3/4": "aspect-[3/4]",
    "16/9": "aspect-[16/9]",
    "1/1": "aspect-square",
    "2/3": "aspect-[2/3]",
  } as const;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-surface-muted",
        ratios[ratio],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("flex flex-1 flex-col p-5", className)} />;
}

/** Small uppercase label above a title — category, tier, date. */
export function CardEyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={cn(
        "text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase",
        className,
      )}
    />
  );
}

export function CardTitle({
  className,
  as: As = "h3",
  ...props
}: ComponentProps<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <As
      {...props}
      className={cn(
        "font-display text-xl leading-snug font-semibold text-balance",
        className,
      )}
    />
  );
}

export function CardText({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    />
  );
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("mt-auto flex items-center gap-3 pt-4", className)}
    />
  );
}

/**
 * Makes the whole card clickable while keeping ONE link in the accessibility
 * tree.
 *
 * The naive version wraps the card in an anchor, which swallows any nested
 * link and reads the entire card's text as the link name. This overlays the
 * card instead, so the accessible name is just the title, and other links
 * inside the card still work provided they sit above it.
 */
export function CardLink({
  className,
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        "after:absolute after:inset-0 after:content-['']",
        "rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--ring)",
        className,
      )}
    >
      {children}
    </Link>
  );
}
