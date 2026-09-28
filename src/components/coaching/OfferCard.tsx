import type { ReactNode } from "react";

import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { CardLink } from "@/components/ui/Card";
import { formatPrice } from "@/lib/commerce/pricing";
import type { ProductPrice } from "@/lib/content/coaching";
import { cn } from "@/lib/utils/cn";

/**
 * One purchasable coaching offer — note 10 §27, note 07 §37.1.
 *
 * ONE CARD FOR EVERY COACHING LISTING: courses, group series, cohorts, private
 * coaching and retreats, so they cannot drift apart.
 *
 * Designed as a ticket rather than a form (owner, 2026-09-26: "equal in size,
 * prices must be visible, not boring"):
 *
 *   - a photograph of what the offer is about (never a title card), in the
 *     same frame on every card, with the PRICE pinned to it as a tag — the
 *     first thing read after the picture, never below a fold;
 *   - a noir body: level, title, a description clamped to three lines, then
 *     a CTA pill that fills on hover.
 *
 * EQUAL SIZE is structural, not hoped for: the photo frame is a fixed ratio,
 * the title is clamped to two lines and the description to three, and every
 * card stretches to its grid row (`h-full`) with a spacer pinning the foot, so
 * cards in a row end level.
 *
 * `feature` is for the only offer on a page: photo beside the body across the
 * row, the same parts in the same order.
 *
 * The whole card is clickable via `CardLink`, which overlays the card while
 * keeping exactly one link in the accessibility tree — the title.
 */
export function OfferCard({
  href,
  title,
  description,
  eyebrow,
  meta,
  prices,
  priceLabel,
  priceNote,
  storagePath,
  seed,
  cta = "View details",
  priority = false,
  feature = false,
  children,
  className,
}: {
  href: string;
  title: string;
  description?: string | null;
  /** Small label above the title — the level or kind. */
  eyebrow?: string;
  /** A fact worth stating on the card: duration, capacity, date. */
  meta?: string | null;
  prices?: ProductPrice[];
  /** A price stated directly, for offers priced by another product (group series). */
  priceLabel?: string | null;
  /** Under the price: "a session", "one payment", "or £130 for eight". */
  priceNote?: string | null;
  storagePath?: string | null;
  /** Stable identity for the generated fallback cover. Always the slug. */
  seed: string;
  cta?: string;
  priority?: boolean;
  feature?: boolean;
  /** Extra body content above the foot — a series' curriculum. */
  children?: ReactNode;
  className?: string;
}) {
  // Cheapest active price, the honest "from" figure; the detail page shows
  // the full choice.
  const cheapest =
    prices && prices.length > 0 ? prices.reduce((a, b) => (a.amount <= b.amount ? a : b)) : null;
  const shownPrice = priceLabel ?? (cheapest ? formatPrice(cheapest.amount, cheapest.currency) : null);
  const shownNote =
    priceNote ??
    (cheapest
      ? cheapest.billing_type === "recurring"
        ? `a ${cheapest.interval ?? "month"}`
        : prices && prices.length > 1
          ? "from"
          : "one payment"
      : null);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-(--radius-lg) bg-block-noir text-block-foreground shadow-card ring-1 ring-block-foreground/10",
        "transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none",
        feature && "md:flex-row",
        className,
      )}
    >
      <div className={cn("relative aspect-4/3 shrink-0 overflow-hidden", feature && "md:aspect-auto md:min-h-96 md:w-1/2")}>
        {storagePath ? (
          <StoredImage
            path={storagePath}
            alt=""
            fill
            quality={90}
            priority={priority}
            sizes={feature ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
            className="transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.05] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <GeneratedCover title={title} seed={seed} showTitle={false} />
        )}
        {/* Weighted to the foot, where the photo meets the noir body. */}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-block-noir/70 via-transparent to-transparent" />

        {/* THE PRICE, pinned to the picture and made to be seen (owner,
            2026-09-26: "very visible"): large figures, white on the button
            red — the one fill that reads on any photograph — and a lift. */}
        {shownPrice ? (
          <p className="absolute top-4 right-4 flex items-baseline gap-1.5 rounded-full bg-button px-5 py-2.5 text-button-foreground shadow-lift ring-1 ring-white/20">
            {shownNote === "from" ? (
              <span className="text-xs font-semibold tracking-wide uppercase opacity-85">from</span>
            ) : null}
            <span className="font-display text-2xl leading-none font-semibold tabular-nums sm:text-[1.75rem]">{shownPrice}</span>
            {shownNote && shownNote !== "from" ? (
              <span className="text-xs font-medium opacity-85">{shownNote}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col p-6 sm:p-7", feature && "md:justify-center md:p-10")}>
        {eyebrow ? (
          <p className="flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.2em] text-block-foreground/65 uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-primary" />
            {eyebrow}
          </p>
        ) : null}

        <h3
          className={cn(
            "mt-3 line-clamp-2 font-display text-2xl leading-tight font-semibold text-balance",
            feature && "md:text-4xl",
          )}
        >
          <CardLink href={href}>{title}</CardLink>
        </h3>

        {description ? (
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed text-block-foreground/70 text-pretty",
              feature ? "md:text-base" : "line-clamp-3",
            )}
          >
            {description}
          </p>
        ) : null}

        {children}

        {/* Pushes the foot to the bottom so every card in a row ends level,
            while keeping at least 1.5rem above it. */}
        <div aria-hidden="true" className={cn("min-h-6", !feature && "flex-1")} />

        <div className="flex items-center justify-between gap-4 border-t border-block-foreground/15 pt-5">
          <span className="text-xs text-block-foreground/60">{meta ?? ""}</span>
          <span
            aria-hidden="true"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-block-foreground/35 px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) group-hover:border-block-foreground group-hover:bg-block-foreground group-hover:text-block-noir"
          >
            {cta}
            <span className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-0.5 motion-reduce:transform-none">
              &rarr;
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
