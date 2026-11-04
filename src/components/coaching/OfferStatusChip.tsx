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
/**
 * Chip sizes, shared by every chip here. Compact on phones (owner, 2026-11-03:
 * on mobile they had "too much space within" and looked odd on a narrow card).
 * Card chips stay compact until lg, as cards are narrow two-up on a tablet;
 * hero chips take their full size from sm.
 */
const CHIP_SIZE = {
  card: "gap-2 px-3 py-1.5 text-xs lg:gap-2.5 lg:px-4 lg:py-2 lg:text-sm",
  hero: "gap-2 px-3.5 py-2 text-sm sm:gap-2.5 sm:px-5 sm:py-3 sm:text-base",
} as const;
const ICON_SIZE = {
  card: "size-3.5 lg:size-4",
  hero: "size-4 sm:size-4.5",
} as const;

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
        "inline-flex max-w-full items-center rounded-full font-semibold shadow-lift",
        CHIP_SIZE[size],
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
          className={cn("shrink-0", ICON_SIZE[size])}
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
          className={cn("shrink-0", ICON_SIZE[size])}
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

/**
 * How many places, beside the status chip (owner, 2026-10-29: the places
 * "more visible", in the teal). Teal as state, like a live status, with a
 * people mark so the two read apart when they sit side by side.
 */
export function PlacesChip({
  label,
  size = "card",
  className,
}: {
  label: string;
  size?: "card" | "hero";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex max-w-full items-center rounded-full bg-accent font-semibold text-accent-foreground shadow-lift ring-1 ring-white/15",
        CHIP_SIZE[size],
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={cn("shrink-0", ICON_SIZE[size])}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6" cy="5" r="2.25" />
        <path d="M1.75 13.5a4.25 4.25 0 0 1 8.5 0" />
        <path d="M10.5 3a2.25 2.25 0 0 1 0 4.25M12 9.5a4.25 4.25 0 0 1 2.25 4" />
      </svg>
      <span className="min-w-0 text-pretty">{label}</span>
    </p>
  );
}

/**
 * A pack's saving, where places would sit (owner, 2026-10-29): "Save £200
 * with a pack of 8". The same teal as the places chip, with a tag mark. With
 * `href` it is a link to the pack (in the hero); on a card it is not, since the
 * whole card is already one.
 */
export function SavingChip({
  label,
  href,
  icon = "tag",
  size = "card",
  className,
}: {
  label: string;
  href?: string | null;
  /** `pass`: a pass holder's perk ("Pass holders save 10%"), not a price saving. */
  icon?: "tag" | "pass";
  size?: "card" | "hero";
  className?: string;
}) {
  const content = (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={cn("shrink-0", ICON_SIZE[size])}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon === "pass" ? (
          <>
            <rect x="1.75" y="3.5" width="12.5" height="9" rx="1.5" />
            <path d="M5.5 3.5v9" strokeDasharray="1.2 1.4" />
            <path d="m9.6 6.2.55 1.12 1.23.18-.89.87.21 1.23-1.1-.58-1.1.58.21-1.23-.89-.87 1.23-.18Z" />
          </>
        ) : (
          <>
            <path d="M8.6 1.75H13a1.25 1.25 0 0 1 1.25 1.25v4.4a1.25 1.25 0 0 1-.37.88l-6.1 6.1a1.25 1.25 0 0 1-1.76 0L1.62 9.98a1.25 1.25 0 0 1 0-1.76l6.1-6.1a1.25 1.25 0 0 1 .88-.37Z" />
            <circle cx="11" cy="5" r="1" />
          </>
        )}
      </svg>
      <span className="min-w-0 text-pretty">{label}</span>
      {href ? (
        <span aria-hidden="true" className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-0.5 motion-reduce:transform-none">
          &rarr;
        </span>
      ) : null}
    </>
  );
  const classes = cn(
    "inline-flex max-w-full items-center rounded-full bg-accent font-semibold text-accent-foreground shadow-lift ring-1 ring-white/15",
    CHIP_SIZE[size],
    className,
  );
  return href ? (
    <a
      href={href}
      className={cn(
        classes,
        "group transition-[box-shadow,filter] duration-(--dur-fast) hover:ring-white/45 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
      )}
    >
      {content}
    </a>
  ) : (
    <p className={classes}>{content}</p>
  );
}

/**
 * The status and places on a card's photograph below lg, and under the price
 * in a product hero on a phone (owner, 2026-11-04: the chips "well designed
 * and arranged well for mobile"). Separate chips
 * there wrapped a long status onto two lines and stacked into a ragged pile,
 * so below lg they are one frosted panel across the foot of the photo: the
 * status on the left, its words split at " · " into a small label over the
 * date, beside a tile in the status's tone; the places as a teal band along
 * its foot, so the status keeps the whole width even on a tablet's two-up
 * card. A pack saving or a pass perk is a row of its own in the same panel,
 * with a teal tile, so private coaching matches the dated cards; in the hero
 * those rows are links (to the pack, to the passes). From lg the card keeps the separate chips. On the narrowest phones
 * the tile steps aside so the words keep the room.
 */
export function StatusPanel({
  status,
  places,
  saving,
  savingHref,
  perk,
  perkHref,
  className,
}: {
  status?: OfferStatus | null;
  places?: string | null;
  /** A pack's saving: "Save £200 with a pack of 8". */
  saving?: string | null;
  /** In the hero, where the saving leads. Not on a card: the card is one link. */
  savingHref?: string | null;
  /** A pass holder's perk: "Pass holders save up to 15%". */
  perk?: string | null;
  perkHref?: string | null;
  className?: string;
}) {
  if (!status && !places && !saving && !perk) return null;
  const offers = [
    ...(saving ? [{ text: saving, href: savingHref, icon: "tag" as const }] : []),
    ...(perk ? [{ text: perk, href: perkHref, icon: "pass" as const }] : []),
  ];
  const { label, detail } = status ? splitStatus(status.label) : { label: null, detail: null };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-(--radius-lg) bg-block-noir/75 text-block-foreground shadow-lift ring-1 ring-block-foreground/20 backdrop-blur-md",
        className,
      )}
    >
      {status ? (
        <div className="flex min-w-0 items-center gap-3 p-2.5 pr-3 max-[22.5rem]:pl-3">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-[calc(var(--radius)-2px)] max-[22.5rem]:hidden",
              status.tone === "live" && "bg-accent text-accent-foreground",
              status.tone === "urgent" && "bg-block-foreground text-block-noir",
              (status.tone === "quiet" || status.tone === "closed") && "bg-block-foreground/12 text-block-foreground",
            )}
          >
            {status.tone === "urgent" ? (
              <span className="relative grid size-2.5 place-items-center">
                <span className="absolute size-2.5 rounded-full bg-button motion-safe:animate-ping" />
                <span className="relative size-2.5 rounded-full bg-button" />
              </span>
            ) : (
              <svg
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {status.tone === "closed" ? (
                  <>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </>
                ) : (
                  <>
                    <rect x="2" y="3" width="12" height="11" rx="2" />
                    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                  </>
                )}
              </svg>
            )}
          </span>
          <p className="min-w-0">
            {label ? (
              <span className="block text-xs leading-snug font-medium text-block-foreground/70">
                {label}
                <span className="sr-only"> · </span>
              </span>
            ) : null}
            <span className="block text-sm leading-snug font-semibold tracking-normal text-balance">{detail}</span>
          </p>
        </div>
      ) : null}
      {offers.map((offer, i) => {
        const rowClass = cn(
          "flex items-center gap-3 p-2.5 pr-3 text-sm leading-snug max-[22.5rem]:pl-3",
          (status || i > 0) && "border-t border-block-foreground/12",
        );
        const content = (
          <>
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-[calc(var(--radius)-2px)] bg-accent text-accent-foreground max-[22.5rem]:hidden"
            >
              <OfferIcon icon={offer.icon} />
            </span>
            <span className="min-w-0 text-pretty">
              <Saving text={offer.text} />
            </span>
          </>
        );
        return offer.href ? (
          <a
            key={offer.text}
            href={offer.href}
            className={cn(
              rowClass,
              "group transition-colors hover:bg-block-foreground/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            )}
          >
            {content}
            <span
              aria-hidden="true"
              className="ml-auto pl-1 transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-0.5 motion-reduce:transform-none"
            >
              &rarr;
            </span>
          </a>
        ) : (
          <p key={offer.text} className={rowClass}>
            {content}
          </p>
        );
      })}
      {places ? (
        <p
          className={cn(
            "flex items-center gap-2 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground",
            !status && "py-2",
          )}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="6" cy="5" r="2.25" />
            <path d="M1.75 13.5a4.25 4.25 0 0 1 8.5 0" />
            <path d="M10.5 3a2.25 2.25 0 0 1 0 4.25M12 9.5a4.25 4.25 0 0 1 2.25 4" />
          </svg>
          {places}
        </p>
      ) : null}
    </div>
  );
}

/** The saving said loudest: "Save £200" or "save up to 15%" bold, the rest quieter. */
function Saving({ text }: { text: string }) {
  const match = text.match(/save(?: up to)? [£$€]?[\d,.]+%?/i);
  if (!match || match.index === undefined) return <span className="font-semibold">{text}</span>;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return (
    <>
      {before ? <span className="text-block-foreground/70">{before}</span> : null}
      <span className="font-semibold">{before ? match[0] : match[0].charAt(0).toUpperCase() + match[0].slice(1)}</span>
      {after ? <span className="text-block-foreground/70">{after}</span> : null}
    </>
  );
}

/** The tag (a pack saving) or pass (a pass holder's perk) mark. */
function OfferIcon({ icon }: { icon: "tag" | "pass" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === "pass" ? (
        <>
          <rect x="1.75" y="3.5" width="12.5" height="9" rx="1.5" />
          <path d="M5.5 3.5v9" strokeDasharray="1.2 1.4" />
          <path d="m9.6 6.2.55 1.12 1.23.18-.89.87.21 1.23-1.1-.58-1.1.58.21-1.23-.89-.87 1.23-.18Z" />
        </>
      ) : (
        <>
          <path d="M8.6 1.75H13a1.25 1.25 0 0 1 1.25 1.25v4.4a1.25 1.25 0 0 1-.37.88l-6.1 6.1a1.25 1.25 0 0 1-1.76 0L1.62 9.98a1.25 1.25 0 0 1 0-1.76l6.1-6.1a1.25 1.25 0 0 1 .88-.37Z" />
          <circle cx="11" cy="5" r="1" />
        </>
      )}
    </svg>
  );
}

/**
 * "Registration open · starts 12 November" → a label and the date under it.
 * The part that says when it starts is the line read first, so it is the
 * detail wherever it falls: "Starts 5 November · in 3 days" reads "In 3 days"
 * over "Starts 5 November". One part alone is the detail, with no label.
 */
function splitStatus(text: string): { label: string | null; detail: string } {
  const parts = text.split(" · ");
  if (parts.length < 2) return { label: null, detail: text };
  const at = parts.findIndex((p) => /^starts\b/i.test(p));
  const detailIndex = at === -1 ? parts.length - 1 : at;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    label: cap(parts.filter((_, i) => i !== detailIndex).join(" · ")),
    detail: cap(parts[detailIndex]),
  };
}
