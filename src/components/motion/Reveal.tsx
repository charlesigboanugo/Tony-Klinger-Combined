"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Reveal content as it scrolls into view — note 10 §37.
 *
 * Deliberately NOT GSAP. This runs on nearly every section of every page, and
 * a scroll-reveal is one IntersectionObserver plus one CSS transition; pulling
 * an animation library into the shared bundle for it would cost every visitor
 * ~40KB to fade some text in.
 *
 * PROGRESSIVE ENHANCEMENT MATTERS HERE. The hidden state is applied by this
 * component after mount, not in the server-rendered HTML. If JavaScript never
 * runs, or fails, the content is simply visible — the failure mode of the
 * opposite arrangement is a blank page, which is the worst possible outcome for
 * a marketing site and for search engines.
 *
 * Reduced motion is honoured twice: the observer still marks elements shown, and
 * the CSS in globals.css collapses the transform for anyone who asked for less
 * motion.
 */
export function Reveal({
  children,
  as: As = "div" as ElementType,
  delay = 0,
  className,
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in ms. Keep under ~240 — beyond that it reads as lag, not rhythm. */
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer (very old browser, some embedded webviews): stay in the
    // un-armed state, which renders visible. Nothing to clean up.
    if (typeof IntersectionObserver === "undefined") return;

    /*
      NEVER HIDE SOMETHING THAT IS ALREADY ON SCREEN.

      An earlier version armed every element to opacity 0 the instant JS ran —
      including everything already visible — and then depended entirely on the
      observer firing to bring it back. That turns a decorative animation into
      a single point of failure for whether the page is readable at all, and it
      is exactly how two whole sections of the home page rendered blank.

      The ARMING IS DONE BY THE OBSERVER ITSELF, in its first callback: an
      element reported as not-intersecting is below the fold and safe to hide,
      and one reported as intersecting is shown and never hidden. Deciding it
      here in the effect body would mean setting state during the effect, which
      React now warns about, and would duplicate a measurement the observer
      already performs.
    */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setShown(false);
          } else {
            // Below the fold on first report: safe to animate in later.
            setArmed(true);
          }
        }
      },
      // Start slightly before the element reaches the viewport so the motion
      // finishes as it arrives rather than beginning once it is already read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(el);

    /*
      Failsafe. If the observer has still not reported after three seconds,
      show the content regardless and stop waiting. A missed animation is a
      cosmetic loss; permanently invisible content is not.
    */
    const failsafe = window.setTimeout(() => setShown(true), 3000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [once]);

  return (
    <As
      ref={ref}
      data-reveal={!armed || shown ? "shown" : "pending"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(className)}
    >
      {children}
    </As>
  );
}
