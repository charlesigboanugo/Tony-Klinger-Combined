import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The site's mark — note 10 §42.2.
 *
 * A monogram and a name, set in the display face, with the three trades
 * beneath on wide screens. It replaces a plain "Tony Klinger" in body type,
 * which read as a placeholder — the one element on every page that most needs
 * to look intended. Text, not an image: sharp at every size, no request, and
 * the link's accessible name is simply the name.
 */
export function Wordmark({
  className,
  compact = false,
  monogramOnPhone = false,
}: {
  className?: string;
  compact?: boolean;
  /** Below sm show only the TK disc — for workspace headers, where the
      workspace name and the account menu need the room. */
  monogramOnPhone?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={monogramOnPhone ? "Tony Klinger, home" : undefined}
      className={cn(
        "group flex shrink-0 items-center gap-2.5 rounded-sm outline-offset-4 min-[360px]:gap-3 focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-current font-display text-[0.8125rem] font-semibold tracking-tight italic transition-transform duration-(--dur-base) ease-expo group-hover:rotate-[-8deg] motion-reduce:transform-none"
      >
        TK
      </span>
      <span className={cn("flex-col", monogramOnPhone ? "hidden sm:flex" : "flex")}>
        {/* One line always: at 320px the name wrapped to two when the mark was
            allowed to shrink beside the Menu toggle. */}
        <span className="font-display text-[1.125rem] leading-none font-semibold tracking-tight whitespace-nowrap min-[360px]:text-[1.3125rem]">
          Tony Klinger
        </span>
        {compact ? null : (
          <span className="mt-1 hidden text-[0.5625rem] font-semibold tracking-[0.32em] text-muted-foreground uppercase xl:block">
            Producer · Author · Coach
          </span>
        )}
      </span>
    </Link>
  );
}
