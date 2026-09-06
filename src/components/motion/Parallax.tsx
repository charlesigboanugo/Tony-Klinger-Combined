"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Depth on scroll — note 10 §37.
 *
 * Like <Reveal>, this is hand-rolled rather than GSAP ScrollTrigger, and for
 * the same reason: it is a few lines of transform maths that would otherwise
 * drag a library into the shared bundle.
 *
 * The rules that keep parallax from wrecking scrolling performance:
 *
 *   - Only `transform` is written. Touching `top` or `background-position`
 *     forces layout on every frame and is the usual cause of janky parallax.
 *   - Reads are throttled through requestAnimationFrame, so a burst of scroll
 *     events collapses into one write per frame.
 *   - The listener is passive, so it can never delay the scroll itself.
 *   - It disables itself entirely under prefers-reduced-motion — parallax is a
 *     common migraine and vertigo trigger, so this is a real accessibility
 *     requirement, not a nicety.
 *   - It disables itself when the element is off-screen, so a long page does
 *     not run maths for sections nobody is looking at.
 */
export function Parallax({
  children,
  speed = 0.15,
  className,
}: {
  children: ReactNode;
  /**
   * Fraction of scroll distance to offset by. Positive drifts the layer
   * upward (it appears further away). Keep it small — beyond ~0.3 the
   * element visibly detaches from the content it belongs to.
   */
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    let frame = 0;
    let visible = false;

    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      // Distance of the element's centre from the viewport's centre, so the
      // offset is zero when it is centred and grows symmetrically either side.
      const fromCentre = rect.top + rect.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-fromCentre * speed).toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!visible || frame) return;
      frame = requestAnimationFrame(apply);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) apply();
      },
      { rootMargin: "20% 0px" },
    );
    io.observe(el);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [speed]);

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
