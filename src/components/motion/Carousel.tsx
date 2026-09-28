"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The one carousel — note 10 §37.
 *
 * OWNER'S RULE (2026-09-24): a slider moves BY ITSELF, on a timer — never
 * driven by page scroll — and always has a way to go back and forth. The
 * scroll-scrubbed GSAP strip it replaces was rejected for exactly that.
 *
 * The track is a native scroll-snap row, so touch swipe, trackpad scroll and
 * keyboard scrolling all work with no code, and without JavaScript it is still
 * a complete, scrollable strip. The script only adds the timer and buttons.
 *
 * Autoplay stops for anything that suggests someone is reading or acting:
 * pointer over it, keyboard focus inside it, the tab hidden, the strip off
 * screen. It never starts under `prefers-reduced-motion`. And there is always
 * a pause button — WCAG 2.2.2 requires one for anything that moves on its own
 * for more than five seconds, and hover-to-pause does not exist on a phone.
 *
 * WHOLE SLIDES ONLY (owner's rule, 2026-09-24): no slide is ever shown cut
 * in half. Size slides as exact fractions of the row (`w-full sm:w-1/2
 * lg:w-1/3`) rather than fixed widths — with snap alignment and one-slide
 * steps, every resting position then shows complete slides only.
 *
 * Progress is shown as a bar spanning the visible window of the strip, not a
 * "3 / 14" counter: with several slides in view the last few can never be the
 * "current" one, and a counter that stops at 11 of 14 reads as broken.
 *
 * `fitHeight` (one slide in view only): the strip takes the height of the
 * slide in view and eases to the next one's, instead of every slide being
 * as tall as the longest. Give the slides a min-height for a steady floor.
 */
export function Carousel({
  children,
  label,
  interval = 5000,
  tone = "page",
  className,
  trackClassName,
  slideClassName,
  fitHeight = false,
}: {
  children: ReactNode;
  /** Names the region for assistive technology. */
  label: string;
  /** Milliseconds each position is held before advancing. */
  interval?: number;
  /** "block" on a jewel field, "page" on the page ground. */
  tone?: "page" | "block";
  className?: string;
  /** Gap and padding for the row itself. */
  trackClassName?: string;
  /** Width of each slide — set per usage. */
  slideClassName?: string;
  /** Size the strip to the slide in view (one-slide carousels). */
  fitHeight?: boolean;
}) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement | null>(null);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false); // hover or focus inside
  const [inView, setInView] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [overflows, setOverflows] = useState(true);
  const [windowBar, setWindowBar] = useState({ start: 0, size: 1 });
  const [height, setHeight] = useState<number | null>(null);

  // Measure where the strip is: which slide sits at the left edge, and what
  // share of the whole strip is visible.
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    let nearest = 0;
    let best = Infinity;
    kids.forEach((kid, i) => {
      const d = Math.abs(kid.offsetLeft - el.scrollLeft);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setIndex(nearest);
    setOverflows(el.scrollWidth - el.clientWidth > 4);
    setWindowBar({
      start: el.scrollLeft / el.scrollWidth,
      size: el.clientWidth / el.scrollWidth,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      setReduced(mq.matches);
      if (mq.matches) setPlaying(false);
    };
    syncMotion();
    mq.addEventListener("change", syncMotion);

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);

    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    measure();

    return () => {
      mq.removeEventListener("change", syncMotion);
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [measure]);

  // Follow the height of the slide in view, and of any slide that reflows
  // (a font loading, the window narrowing).
  useEffect(() => {
    const el = track.current;
    if (!fitHeight || !el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const sync = () => {
      const kid = kids[index];
      if (kid) setHeight(kid.offsetHeight);
    };
    sync();
    const ro = new ResizeObserver(sync);
    kids.forEach((k) => ro.observe(k));
    return () => ro.disconnect();
  }, [fitHeight, index]);

  const scrollToSlide = useCallback(
    (i: number) => {
      const el = track.current;
      const kid = el?.children[i] as HTMLElement | undefined;
      if (!el || !kid) return;
      el.scrollTo({ left: kid.offsetLeft, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  const atEnd = () => {
    const el = track.current;
    return !el || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  };

  // Forward wraps to the start and back wraps to the end, so neither button
  // is ever a dead end.
  const next = useCallback(() => {
    if (atEnd()) scrollToSlide(0);
    else scrollToSlide(index + 1);
  }, [index, scrollToSlide]);

  const prev = () => {
    const el = track.current;
    if (!el) return;
    if (el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: reduced ? "auto" : "smooth" });
    else scrollToSlide(Math.max(0, index - 1));
  };

  // Media started inside a slide (VideoFacade dispatches "media:play") stops
  // autoplay for good: advancing would slide a playing video out of view, and
  // once the iframe has focus the carousel can no longer see the reader.
  const root = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stop = () => setPlaying(false);
    el.addEventListener("media:play", stop);
    return () => el.removeEventListener("media:play", stop);
  }, []);

  const running = playing && !held && inView && !pageHidden && !reduced && overflows;

  // One timeout per position: any movement (timer, button or swipe) changes
  // `index` and so restarts the wait, which is what a reader expects.
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(next, interval);
    return () => window.clearTimeout(t);
  }, [running, index, interval, next]);

  const onBlock = tone === "block";
  const control = cn(
    "grid h-11 w-11 place-items-center rounded-full border transition-[background-color,border-color,color] duration-(--dur-fast) ease-expo",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    onBlock
      ? "border-block-foreground/40 text-block-foreground hover:border-block-foreground hover:bg-block-foreground/15"
      : "border-input-border text-foreground hover:border-foreground hover:bg-foreground/8",
  );

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label={label}
      className={className}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div
        ref={track}
        aria-live={running ? "off" : "polite"}
        className={cn(
          "relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          "scrollbar-none [&::-webkit-scrollbar]:hidden",
          fitHeight &&
            "items-start transition-[height] duration-(--dur-base) ease-expo motion-reduce:transition-none",
          trackClassName,
        )}
        style={fitHeight && height ? { height } : undefined}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className={cn("shrink-0 snap-start", slideClassName)}
          >
            {slide}
          </div>
        ))}
      </div>

      {overflows ? (
        <div className="mt-10 flex items-center gap-6">
          <div
            aria-hidden="true"
            className={cn(
              "relative h-px flex-1 overflow-hidden",
              onBlock ? "bg-block-foreground/20" : "bg-border",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 transition-[left,width] duration-(--dur-base) ease-expo",
                onBlock ? "bg-block-foreground" : "bg-foreground",
              )}
              style={{
                left: `${windowBar.start * 100}%`,
                width: `${windowBar.size * 100}%`,
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={prev} className={control} aria-label="Previous">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {!reduced ? (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className={control}
                aria-label={playing ? "Pause autoplay" : "Start autoplay"}
              >
                {playing ? (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
                    <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
                    <path d="M7 4.5v11l9-5.5z" fill="currentColor" />
                  </svg>
                )}
              </button>
            ) : null}
            <button type="button" onClick={next} className={control} aria-label="Next">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
