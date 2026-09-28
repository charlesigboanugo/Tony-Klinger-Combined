"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A strip that glides continuously, like the credits marquee, but can still
 * be driven by hand — note 10 §37.
 *
 * Two owner's rules meet here (2026-09-24): the catalogue should keep moving
 * the way the "On set with" names do, and every slider must have a way to go
 * back and forth. A CSS marquee cannot be nudged, so this one is driven by a
 * requestAnimationFrame loop that owns a single offset: it creeps forward at
 * a steady speed, and the previous / next buttons add an eased jump of one
 * slide on top of that — the strip never stops to do it, it just slides on.
 *
 * The children are rendered twice and the offset wraps at the width of one
 * set, so the loop is seamless. The copy is `inert` and `aria-hidden`: a
 * keyboard or screen-reader user meets every work once.
 *
 * Pauses under the pointer, with focus inside, when off screen and when the
 * tab is hidden; a pause button covers phones and WCAG 2.2.2. Under
 * `prefers-reduced-motion` it never glides — the buttons still step through
 * it, instantly — and without JavaScript it is a plain scrollable row.
 */
export function LoopingStrip({
  children,
  label,
  speed = 34,
  tone = "page",
  className,
  slideClassName,
  gap = 24,
}: {
  children: ReactNode;
  label: string;
  /** Pixels per second of the glide. Slow: covers are looked at, not chased. */
  speed?: number;
  tone?: "page" | "block";
  className?: string;
  slideClassName?: string;
  /** Space between slides, in px. Part of the wrap maths, so not a class. */
  gap?: number;
}) {
  const slides = Children.toArray(children);
  const viewport = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const firstSet = useRef<HTMLDivElement | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  // Mutable loop state lives in refs: the loop reads it every frame, and
  // re-rendering React 60 times a second to move one transform would be waste.
  const offset = useRef(0);
  // A button press: `to` px to add over NUDGE_MS, `applied` px added so far.
  const nudge = useRef({ to: 0, applied: 0, start: 0, active: false });
  const held = useRef(false);
  const visible = useRef(false);
  const playingRef = useRef(true);
  const reducedRef = useRef(false);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const vp = viewport.current;
    const tr = track.current;
    const set = firstSet.current;
    if (!vp || !tr || !set) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    setReduced(mq.matches);
    setReady(true);

    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(vp);

    let raf = 0;
    let last = performance.now();
    const NUDGE_MS = 650;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      const setWidth = set.offsetWidth + gap;

      const gliding =
        playingRef.current && !held.current && visible.current && !document.hidden && !reducedRef.current;
      if (gliding) offset.current += speed * dt;

      const n = nudge.current;
      if (n.active) {
        const t = Math.min((now - n.start) / NUDGE_MS, 1);
        const applied = n.to * (1 - Math.pow(1 - t, 3)); // ease-out cubic
        offset.current += applied - n.applied;
        n.applied = applied;
        if (t >= 1) n.active = false;
      }

      if (setWidth > 0) offset.current = ((offset.current % setWidth) + setWidth) % setWidth;
      tr.style.transform = `translate3d(${-offset.current}px,0,0)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [gap, speed]);

  const step = (dir: 1 | -1) => {
    const first = firstSet.current?.firstElementChild as HTMLElement | null;
    const distance = (first?.offsetWidth ?? 280) + gap;
    if (reducedRef.current) {
      offset.current += dir * distance;
      return;
    }
    nudge.current = { to: dir * distance, applied: 0, start: performance.now(), active: true };
  };

  const onBlock = tone === "block";
  const control = cn(
    "grid h-11 w-11 place-items-center rounded-full border transition-[background-color,border-color] duration-(--dur-fast) ease-expo",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    onBlock
      ? "border-block-foreground/40 text-block-foreground hover:border-block-foreground hover:bg-block-foreground/15"
      : "border-input-border text-foreground hover:border-foreground hover:bg-foreground/8",
  );

  const set = (copy: boolean) => (
    <div
      ref={copy ? undefined : firstSet}
      aria-hidden={copy || undefined}
      inert={copy || undefined}
      className="flex shrink-0"
      style={{ gap }}
    >
      {slides.map((slide, i) => (
        <div key={i} className={cn("shrink-0", slideClassName)}>
          {slide}
        </div>
      ))}
    </div>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={className}
      onMouseEnter={() => (held.current = true)}
      onMouseLeave={() => (held.current = false)}
      onFocus={() => (held.current = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) held.current = false;
      }}
    >
      {/* Before hydration this is an ordinary scrollable row; once the loop
          owns the transform, scrolling is switched off so the two never fight. */}
      <div ref={viewport} className={cn(ready ? "overflow-hidden" : "overflow-x-auto")}>
        <div ref={track} className="flex w-max will-change-transform" style={{ gap }}>
          {set(false)}
          {ready ? set(true) : null}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-end gap-2">
        <button type="button" onClick={() => step(-1)} className={control} aria-label="Previous">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {!reduced ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className={control}
            aria-label={playing ? "Pause" : "Play"}
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
        <button type="button" onClick={() => step(1)} className={control} aria-label="Next">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}
