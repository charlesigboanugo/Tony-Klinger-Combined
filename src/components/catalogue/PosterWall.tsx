import type { CSSProperties, ReactNode } from "react";

import { StoredImage } from "@/components/media/StoredImage";
import { COVER_FOCUS_CLASS, type CoverFocus } from "@/lib/content/catalogue";
import { cn } from "@/lib/utils/cn";

type Poster = { path: string; focus: CoverFocus };

/** Seconds per loop for each row — unequal, so the rows never fall into step. */
const ROW_SECONDS = [90, 120, 105, 130];

/**
 * The catalogue's opening frame — note 10 §37, §42.
 *
 * A WALL OF THE WORK, WITH THE TITLE IN FRONT OF IT. Four rows of the real
 * posters drift sideways in alternating directions across the whole width,
 * tilted a few degrees, and the words sit centred over a darkened middle.
 * Not a split: the owner asked (2026-09-25) for page openings other than
 * words-beside-a-picture.
 *
 * Pure CSS motion: each row is the `marquee` keyframe (globals.css) over a
 * track holding its posters twice, so the loop is seamless and costs no
 * JavaScript. Every poster is decoration here — each collection's own page
 * lists its works with titles — so the wall is `aria-hidden` with empty alts.
 *
 * WCAG 2.2.2: anything that moves by itself for more than five seconds needs
 * a way to stop it. The pause control is a real checkbox (keyboard- and
 * screen-reader-operable) whose state pauses the rows through `:has()`, so
 * it too needs no script. Under reduced motion the rows never move and the
 * control is not shown.
 */
export function PosterWall({ posters, children }: { posters: Poster[]; children: ReactNode }) {
  // Four rows, so a tall phone screen is covered top to bottom (on wide
  // screens the fourth runs past the edge and is clipped). Each starts at a
  // different point in the set, so no column repeats one poster down the wall.
  const rows = [0, 1, 2, 3].map((r) => {
    const shift = Math.floor((posters.length / 4) * r);
    const row = [...posters.slice(shift), ...posters.slice(0, shift)];
    // Enough posters that one run is wider than the widest screen.
    while (row.length > 0 && row.length < 12) row.push(...row);
    return row;
  });

  return (
    <section className="group/wall grain relative isolate overflow-hidden bg-block-noir text-block-foreground">
      {posters.length > 0 ? (
        <div
          aria-hidden="true"
          className="absolute inset-[-12%] -z-20 flex -rotate-6 flex-col justify-center gap-4 opacity-55 sm:gap-6"
        >
          {rows.map((row, r) => (
            <div
              key={r}
              className={cn(
                "flex w-max animate-[marquee_var(--wall-seconds)_linear_infinite] motion-reduce:animate-none",
                "group-has-[input[data-wall-pause]:checked]/wall:[animation-play-state:paused]",
                r % 2 === 1 && "[animation-direction:reverse]",
              )}
              style={{ "--wall-seconds": `${ROW_SECONDS[r]}s` } as CSSProperties}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 gap-4 pr-4 sm:gap-6 sm:pr-6">
                  {row.map((poster, i) => (
                    <div
                      key={`${poster.path}-${i}`}
                      className="relative aspect-3/4 w-28 shrink-0 overflow-hidden rounded-sm sm:w-40 lg:w-44"
                    >
                      <StoredImage
                        path={poster.path}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 176px, 112px"
                        className={COVER_FOCUS_CLASS[poster.focus]}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {/* Darken the wall toward the middle, where the words are, and toward
          the edges, so it reads as light behind the title, not a collage. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,color-mix(in_oklab,var(--block-noir)_92%,transparent)_0%,color-mix(in_oklab,var(--block-noir)_70%,transparent)_55%,color-mix(in_oklab,var(--block-noir)_35%,transparent)_100%)]"
      />

      <div className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:min-h-[calc(100svh-4.5rem)]">
        {children}
      </div>

      {posters.length > 0 ? (
        <label className="absolute right-4 bottom-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-block-foreground/30 bg-block-noir/70 px-4 py-2 text-xs font-semibold text-block-foreground backdrop-blur-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white hover:border-block-foreground/70 motion-reduce:hidden sm:right-6 sm:bottom-6">
          <input type="checkbox" data-wall-pause className="peer sr-only" />
          <span className="peer-checked:hidden">Pause motion</span>
          <span className="hidden peer-checked:inline">Play motion</span>
        </label>
      ) : null}
    </section>
  );
}
