import type { OfferStatus } from "@/lib/content/offer-status";
import { cn } from "@/lib/utils/cn";

/**
 * When an offer is on, as a chip that is seen — note 10.
 *
 * The start date and "closing soon" used to be a line of small grey text at
 * the foot of a card (owner, 2026-10-09: "much more visible"). It sits on the
 * photograph now, on cards and in the product hero alike.
 *
 *   live     teal — the site's colour for state, in both themes
 *   urgent   white with a red mark: closing or ending soon, nearly full. Not a
 *            red fill, which on a card would be a second price tag.
 *   quiet    a dark glass chip: nothing to act on yet
 *   closed   the same dark chip with a padlock: nothing more can be bought
 *
 * The tone is never the only signal: the words say it too.
 */
export function OfferStatusChip({
  status,
  size = "card",
  className,
}: {
  status: OfferStatus;
  /** `hero` is the larger one, beside the price on a product page. */
  size?: "card" | "hero";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex max-w-full items-center gap-2.5 rounded-full font-semibold shadow-lift",
        size === "hero" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm",
        status.tone === "live" && "bg-accent text-accent-foreground ring-1 ring-white/15",
        status.tone === "urgent" && "bg-block-foreground text-block-noir",
        (status.tone === "quiet" || status.tone === "closed") &&
          "bg-block-noir/75 font-medium text-block-foreground ring-1 ring-block-foreground/30 backdrop-blur-sm",
        className,
      )}
    >
      {status.tone === "urgent" ? (
        // A steady mark with a slow pulse behind it; still for reduced motion.
        <span aria-hidden="true" className="relative grid size-2.5 shrink-0 place-items-center">
          <span className="absolute size-2.5 rounded-full bg-button motion-safe:animate-ping" />
          <span className="relative size-2.5 rounded-full bg-button" />
        </span>
      ) : status.tone === "closed" ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={cn("shrink-0", size === "hero" ? "size-4.5" : "size-4")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={cn("shrink-0", size === "hero" ? "size-4.5" : "size-4")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      )}
      <span className="min-w-0 text-pretty">{status.label}</span>
    </p>
  );
}
