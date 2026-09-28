import { Fragment } from "react";

import { photoCredit } from "@/lib/site/photo-credits";
import { cn } from "@/lib/utils/cn";

/**
 * The photographer's credit for one or more static photos — see
 * `src/lib/site/photo-credits.ts`. Renders nothing when none is owed.
 *
 * THE CREDIT NEVER COMPETES WITH THE PAGE'S OWN WORDS (owner's rule,
 * 2026-09-24). It is always small, always at the bottom RIGHT — under the
 * photo or in its corner — and never set in a text column beside a heading.
 * Position and size belong to this component; callers pass colour only.
 *
 * - `caption` (default): a `<figcaption>` right-aligned under the frame, so
 *   place it inside the `<figure>` that holds the photo. Colour comes from
 *   the caller's `className` because it sits on whatever surface the section
 *   uses.
 * - `overlay`: for a photo with no space under it (a banner, a split, the
 *   hero). Pinned to the bottom-right corner of the nearest positioned
 *   ancestor on a faint dark chip, so it stays legible over any part of any
 *   photo without drawing the eye.
 */
export function PhotoCredit({
  src,
  variant = "caption",
  className,
}: {
  src: string | readonly string[];
  variant?: "caption" | "overlay";
  className?: string;
}) {
  const credit = photoCredit(src);
  if (!credit) return null;

  // Each name links to the photographer's own site where one is recorded.
  const names = credit.photographers.map((p, i) => {
    const sep =
      i === 0 ? "" : i === credit.photographers.length - 1 ? " and " : ", ";
    return (
      <Fragment key={p.name}>
        {sep}
        {p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-current/40 underline-offset-2 transition-colors hover:decoration-current"
          >
            {p.name}
          </a>
        ) : (
          p.name
        )}
      </Fragment>
    );
  });
  const line = (
    <>
      {credit.lead} {names}
    </>
  );

  if (variant === "overlay") {
    return (
      <p
        className={cn(
          "absolute right-3 bottom-3 z-10 rounded-sm bg-black/35 px-1.5 py-px text-[0.625rem] leading-relaxed text-white/75",
          className,
        )}
      >
        {line}
      </p>
    );
  }

  return (
    <figcaption
      className={cn("mt-2 text-right text-[0.625rem] leading-snug", className)}
    >
      {line}
    </figcaption>
  );
}
