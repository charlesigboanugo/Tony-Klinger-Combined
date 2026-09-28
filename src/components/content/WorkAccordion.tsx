"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";

import { ExternalMark } from "@/components/navigation/ExternalMark";
import { ButtonArrow } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export type AccordionPanel = {
  id: string;
  title: string;
  /** Small line above the title — the work's format. */
  kicker: string;
  description: string | null;
  link: { href: string; external: boolean } | null;
  /** The cover, rendered on the server and passed through. */
  media: ReactNode;
};

/**
 * A row of works as one block of panels, ONE ALWAYS OPEN.
 *
 * The panels sit edge to edge, parted by hairlines, each carrying its format
 * and title along the bottom. The open panel holds about a third of the row in
 * full colour, its cover zooming out to its full frame, its title set larger and a line of description faded in. It
 * widens; it never grows taller. The rest are narrow
 * slices of their covers in black and white, dimmed.
 *
 * WHAT OPENS A PANEL. Pointing at it, or focusing it from the keyboard. It
 * STAYS open when the pointer leaves: the row never drops back to equal
 * slices. With nothing open, every panel would be a sliver and none could be
 * read. The first work is open on arrival.
 *
 * On a touch screen the first tap on a closed panel opens it rather than
 * following its link; the second tap follows. With a mouse, hovering has
 * already opened the panel, so one click follows the link.
 *
 * Below lg there is no hover and no room for slices, so the row becomes a
 * swipeable strip of full cards, every one open.
 *
 * The widening is a flex-grow transition. Every panel's text stays in the DOM
 * and in reading order, so screen readers get every work either way.
 */
export function WorkAccordion({
  panels,
  label,
}: {
  panels: AccordionPanel[];
  label: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <ul
      aria-label={label}
      className={cn(
        "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6",
        "lg:mx-0 lg:h-[min(34rem,70svh)] lg:gap-px lg:overflow-hidden lg:rounded-sm lg:bg-black lg:px-0 lg:pb-0 lg:shadow-lift",
      )}
    >
      {panels.map((panel, i) => {
        const open = i === active;
        const follow = (event: MouseEvent) => {
          if (!open) {
            event.preventDefault();
            setActive(i);
          }
        };

        return (
          <li
            key={panel.id}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setActive(i);
            }}
            onFocus={() => setActive(i)}
            data-open={open || undefined}
            className={cn(
              "group relative w-[74vw] max-w-sm shrink-0 snap-start overflow-hidden rounded-sm sm:w-[42vw]",
              "lg:w-auto lg:max-w-none lg:shrink lg:basis-0 lg:grow lg:rounded-none",
              "lg:transition-[flex-grow] lg:duration-700 lg:ease-expo motion-reduce:transition-none",
              open && "lg:grow-[2.6]",
            )}
          >
            <article className="relative isolate flex aspect-3/4 h-full flex-col justify-end text-white lg:aspect-auto">
              <div
                className={cn(
                  // Closed covers sit pushed in; opening a panel pulls the
                  // camera back, easing the cover out to its full frame
                  // while the colour comes up.
                  "absolute inset-0 -z-10 transition-[filter,scale] duration-1000 ease-expo motion-reduce:transition-none",
                  "lg:scale-[1.12] lg:brightness-[0.55] lg:grayscale lg:motion-reduce:scale-100",
                  "lg:group-data-open:scale-100 lg:group-data-open:brightness-100 lg:group-data-open:grayscale-0",
                )}
              >
                {panel.media}
              </div>
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/35 to-transparent"
              />

              <div className="p-5 sm:p-6">
                <p className="text-[0.625rem] font-semibold tracking-[0.2em] text-white/70 uppercase">
                  {panel.kicker}
                </p>
                <h3
                  className={cn(
                    "mt-2 font-display leading-tight font-semibold text-balance",
                    "text-xl sm:text-2xl lg:line-clamp-3 lg:text-lg lg:text-white/80 lg:transition-[font-size,color] lg:duration-700 lg:ease-expo motion-reduce:transition-none",
                    "lg:group-data-open:line-clamp-2 lg:group-data-open:text-3xl lg:group-data-open:text-white",
                  )}
                >
                  {panel.link ? (
                    <Link
                      href={panel.link.href}
                      onClick={follow}
                      {...(panel.link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      // Stretched over the panel, so the whole panel is the
                      // target and focusing it opens it.
                      className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-white"
                    >
                      {panel.title}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      className="text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-white lg:cursor-default"
                    >
                      {panel.title}
                    </button>
                  )}
                </h3>

                {/* ONLY WIDTH AND TYPE SIZE CHANGE. On wide screens the
                    open panel's words are one line whose room every panel
                    keeps, faded in rather than grown in, so opening a panel
                    never lifts its title or makes the panel look taller. */}
                {panel.description ? (
                  <p
                    className={cn(
                      "mt-3 line-clamp-3 text-sm leading-relaxed text-white/85",
                      "lg:mt-2 lg:line-clamp-1 lg:opacity-0 lg:transition-opacity lg:duration-500 motion-reduce:transition-none",
                      "lg:group-data-open:opacity-100 lg:group-data-open:delay-200",
                    )}
                  >
                    {panel.description}
                  </p>
                ) : null}
                {/* The whole panel is the link on wide screens; on phones an
                    explicit cue helps. */}
                {panel.link ? (
                  <p className="mt-4 flex items-center gap-2 text-sm font-semibold lg:hidden">
                    {panel.link.external ? "Watch" : "Discover"}
                    {panel.link.external ? (
                      <ExternalMark className="h-3 w-3 shrink-0" />
                    ) : (
                      <ButtonArrow />
                    )}
                  </p>
                ) : null}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
