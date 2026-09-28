import { Fragment, type CSSProperties } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A slow, endless line of names — note 10 §37.
 *
 * Pure CSS: a server component with one keyframe animation (`marquee` in
 * globals.css), so it costs no JavaScript at all and moves from first paint.
 *
 * The track holds the list twice and slides by half its own width, which puts
 * the second run exactly where the first started — a seamless loop with no
 * measuring. Only the first run is exposed to assistive technology; the copy is
 * `aria-hidden`, so a screen reader hears each name once.
 *
 * It pauses under the pointer, and under `prefers-reduced-motion` it stops
 * being a marquee altogether: the copy is dropped and the one list wraps onto
 * as many centred lines as it needs, so every name is still readable.
 */
export function Marquee({
  items,
  label,
  duration = 48,
  className,
}: {
  items: string[];
  /** Names the list for assistive technology, e.g. "Tony has worked with". */
  label: string;
  /** Seconds for one full run. Slow: it is read, not watched. */
  duration?: number;
  className?: string;
}) {
  const run = (hidden: boolean) => (
    <ul
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden || undefined}
      className={cn(
        "flex shrink-0 items-center",
        hidden
          ? "motion-reduce:hidden"
          : "motion-reduce:w-full motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-2",
      )}
    >
      {items.map((item, i) => (
        <Fragment key={item}>
          <li
            className={cn(
              // A fifth smaller than the 4xl/6xl/7xl it was (owner, 2026-09-26),
              // spacing scaled with it.
              "px-4 font-display text-[1.8rem] leading-none whitespace-nowrap sm:px-6.5 sm:text-5xl lg:text-[3.6rem]",
              // Alternate solid roman and outlined italic, so a line of names
              // reads as a set of credits rather than one long sentence.
              i % 2 === 1 &&
                "text-transparent italic [-webkit-text-stroke:1px_var(--foreground)]",
            )}
          >
            {item}
          </li>
          <li aria-hidden="true" className="text-base text-primary sm:text-[1.2rem]">
            &#10022;
          </li>
        </Fragment>
      ))}
    </ul>
  );

  return (
    <div className={cn("group overflow-hidden", className)}>
      <div
        className="flex w-max animate-[marquee_var(--marquee-duration)_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none"
        style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      >
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
