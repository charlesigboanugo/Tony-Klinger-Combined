import type { ReactNode } from "react";

import { StatusPanel, OfferStatusChip, PlacesChip, SavingChip } from "@/components/coaching/OfferStatusChip";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { CardLink } from "@/components/ui/Card";
import { formatPrice } from "@/lib/commerce/pricing";
import type { ProductPrice } from "@/lib/content/coaching";
import type { OfferStatus } from "@/lib/content/offer-status";
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
  facts,
  status,
  places,
  saving,
  perk,
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
  /**
   * The details someone decides on, under the title with an icon each
   * (owner, 2026-11-03: "important details" were small grey text at the
   * foot): when it meets, the dates, how many sessions.
   */
  facts?: Array<{ icon: "clock" | "calendar" | "count"; text: string }>;
  /** When it is on, as a chip on the photograph: the start date, closing soon. */
  status?: OfferStatus | null;
  /** How many places, beside the status on the photograph: "8 places left". */
  places?: string | null;
  /** A pack's saving, in the places spot: "Save £200 with a pack of 8". */
  saving?: string | null;
  /** A pass holder's perk, at the foot of the photo where a status would be: "Pass holders save up to 15%". */
  perk?: string | null;
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
        {/* The places on the left edge, level with the price (owner,
            2026-10-29); the price keeps the right. Both rows of chips are
            inset to the card body's own padding (owner, 2026-11-03: the chips
            should align), so chips and text share one left edge.

            BELOW lg (owner, 2026-11-03: "make sure mobile makes sense") the
            price stands alone top right, a size smaller on a phone, and every
            other chip moves to the foot of the picture: on a phone or a
            tablet's two-up card a chip beside the price staggered onto two
            rows. */}
        {shownPrice || places || saving ? (
          <div className="absolute top-5 right-6 left-6 flex flex-wrap items-center justify-between gap-2 sm:right-7 sm:left-7">
            <span className="hidden lg:contents">
              {places ? <PlacesChip label={places} /> : null}
              {saving ? <SavingChip label={saving} /> : null}
            </span>
            {shownPrice ? (
              <p className="ml-auto flex items-baseline gap-1.5 rounded-full bg-button px-4 py-2 text-button-foreground shadow-lift ring-1 ring-white/20 sm:px-5 sm:py-2.5">
                {shownNote === "from" ? (
                  <span className="text-xs font-semibold tracking-wide uppercase">from</span>
                ) : null}
                <span className="font-display text-xl leading-none font-semibold tabular-nums sm:text-2xl lg:text-[1.75rem]">{shownPrice}</span>
                {shownNote && shownNote !== "from" ? (
                  <span className="text-xs font-medium">{shownNote}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* WHEN IT IS ON, at the foot of the picture where the eye lands
            after the price (owner, 2026-10-09: the date "much more visible").
            From lg, chips in a row. Below lg, the status and places are one
            panel across the foot (owner, 2026-11-04: arranged well for
            mobile), a pack saving or a pass perk a row of its own in it. */}
        {status || perk || places || saving ? (
          <div className="absolute right-6 bottom-5 left-6 flex flex-col items-start gap-2 sm:right-7 sm:left-7 lg:flex-row lg:flex-wrap lg:items-center">
            <span className="contents max-lg:hidden">
              {status ? <OfferStatusChip status={status} /> : null}
            </span>
            {perk ? <SavingChip label={perk} icon="pass" className="max-lg:hidden" /> : null}
            <StatusPanel status={status} places={places} saving={saving} perk={perk} className="w-full lg:hidden" />
          </div>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col p-6 sm:p-7", feature && "md:justify-center md:p-10")}>
        {eyebrow ? (
          <p className="flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.2em] text-block-foreground/65 uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-primary" />
            {eyebrow}
          </p>
        ) : null}

        <h2
          className={cn(
            "mt-3 line-clamp-2 font-display text-2xl leading-tight font-semibold text-balance tracking-normal",
            feature && "md:text-4xl",
          )}
        >
          <CardLink href={href}>{title}</CardLink>
        </h2>

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

        {facts && facts.length > 0 ? (
          <ul className="mt-4 grid gap-1.5 text-sm text-block-foreground/90">
            {facts.map((fact) => (
              <li key={fact.text} className="flex items-center gap-2.5">
                <FactIcon icon={fact.icon} />
                {fact.text}
              </li>
            ))}
          </ul>
        ) : null}

        {children}

        {/* Pushes the foot to the bottom so every card in a row ends level,
            while keeping at least 1.5rem above it. */}
        <div aria-hidden="true" className={cn("min-h-6", !feature && "flex-1")} />

        {/* The button is a solid light pill (owner, 2026-11-03: it was a thin
            outline, easy to miss), full width on a phone. */}
        <div className="flex flex-col gap-4 border-t border-block-foreground/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {meta ? <span className="text-xs text-block-foreground/60">{meta}</span> : <span aria-hidden="true" className="hidden sm:block" />}
          <span
            aria-hidden="true"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-block-foreground px-5 text-sm font-semibold whitespace-nowrap text-block-noir transition-[filter,box-shadow] duration-(--dur-fast) group-hover:brightness-110 group-hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--block-foreground)_22%,transparent)] max-sm:w-full"
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

/** The small icon beside a card fact. */
function FactIcon({ icon }: { icon: "clock" | "calendar" | "count" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-block-foreground/55"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === "clock" ? (
        <>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 4.75V8l2.25 1.5" />
        </>
      ) : icon === "calendar" ? (
        <>
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </>
      ) : (
        <>
          <rect x="2" y="2.5" width="12" height="11" rx="2" />
          <path d="M5 6h6M5 8.5h6M5 11h3.5" />
        </>
      )}
    </svg>
  );
}
