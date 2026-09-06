"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A strip that pans sideways as the page scrolls past it — note 10 §37.
 *
 * THIS IS WHERE GSAP EARNS ITS PLACE, and it is the only place it is used.
 * Reveals and parallax are hand-rolled precisely because a library is not worth
 * 40KB to fade text in. Scroll-SCRUBBING is different: it means pinning a
 * section, mapping scroll distance onto a timeline, keeping that in sync
 * through resizes, refreshes and back-navigation, and unwinding it cleanly.
 * Hand-rolling that is where scroll effects usually turn janky, and
 * ScrollTrigger already solves it.
 *
 * Cost control, since speed is the priority:
 *
 *   - `import("gsap")` sits INSIDE the effect, so gsap and ScrollTrigger form
 *     their own chunk, fetched only by a page that renders this and only on the
 *     client. Nothing enters the shared bundle.
 *   - `prefers-reduced-motion` skips the import entirely — no download at all
 *     for someone who will never see the animation. A horizontally moving band
 *     tied to scroll is a strong vestibular trigger, so this is a genuine
 *     accessibility requirement rather than a nicety.
 *   - Narrow screens skip it too: there is no room to pan, and phones are where
 *     the frame budget is tightest.
 *   - Everything is reverted on unmount, so a client navigation cannot leave a
 *     pinned section or a stale trigger behind.
 *
 * DEGRADES TO A NORMAL SCROLLING ROW. Without JS, without gsap, on a phone or
 * under reduced motion, the children render as an ordinary horizontally
 * scrollable strip — still complete, still usable.
 */
export function ScrollPan({ children }: { children: ReactNode }) {
  const section = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sectionEl = section.current;
    const trackEl = track.current;
    if (!sectionEl || !trackEl) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 1023px)").matches) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      let gsap, ScrollTrigger;
      try {
        ({ gsap } = await import("gsap"));
        ({ ScrollTrigger } = await import("gsap/ScrollTrigger"));
      } catch {
        return; // Strip stays a plain scrollable row.
      }
      if (disposed) return;

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        // How far the track overflows its container is exactly how far it pans.
        const distance = () => trackEl.scrollWidth - sectionEl.offsetWidth;
        if (distance() <= 0) return;

        /*
          NOT PINNED, deliberately.

          Pinning gives the classic scroll-jacked strip, and it was tried: it
          added roughly 2,500px of scroll for one row of cards, turned the
          section into a dead gap for anyone scrolling past, and took the page
          from 4,900px to 7,400px. Scroll-jacking is contentious at the best of
          times and it directly contradicts a stated speed and usability
          priority.

          Instead the strip pans as it TRAVELS THROUGH the viewport: entering
          from the bottom starts the movement, leaving the top ends it. Same
          sense of range and motion, no hijacked scroll, no extra page height,
          and a reader who scrolls straight past loses nothing.
        */
        gsap.fromTo(
          trackEl,
          { x: 0 },
          {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: sectionEl,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        );
      }, sectionEl);

      cleanup = () => ctx.revert();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div ref={section} className="overflow-hidden">
      <div
        ref={track}
        className="flex gap-5 overflow-x-auto pb-2 lg:overflow-visible lg:will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
