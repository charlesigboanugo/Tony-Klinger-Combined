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
 *
 * Every jump — a button, a swipe let go — is carried by one spring rather
 * than a fixed animation: it starts gently, keeps its speed when a second
 * press lands mid-move, and eases to a stop, so the motion never hiccups
 * (owner, 2026-10-28).
 *
 * ON A PHONE (below `sm`) it glides the same way, but a press or swipe lands
 * one complete cover in the middle, its neighbours either side, and holds it
 * there for a few seconds before easing back into the glide (owner,
 * 2026-10-27/28). The strip follows the finger; a swipe carries on, with its
 * momentum, to the next cover in the direction it went.
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
  // Phone mode: true once measured below `sm`.
  const [stepMode, setStepMode] = useState(false);

  // Mutable loop state lives in refs: the loop reads it every frame, and
  // re-rendering React 60 times a second to move one transform would be waste.
  const offset = useRef(0);
  // The spring carrying a jump: `left` px still to travel, `v` its speed.
  const spring = useRef({ left: 0, v: 0 });
  const held = useRef(false);
  const visible = useRef(false);
  const playingRef = useRef(true);
  const reducedRef = useRef(false);
  const stepModeRef = useRef(false);
  const lastStep = useRef(0);
  // A finger on the strip (phones): where it went down, the offset then, and
  // which way the gesture turned out to go (null until it has moved enough).
  const drag = useRef<{
    x: number;
    y: number;
    base: number;
    axis: "x" | "y" | null;
    // The finger's last position and time, for its speed on release.
    lastX: number;
    lastT: number;
    vx: number;
  } | null>(null);
  // Set by the loop's effect, which owns the offset it moves.
  const stepFn = useRef<(dir: 1 | -1 | 0, instant?: boolean) => void>(() => {});
  // Set with it: ends a swipe, given its direction and the finger's speed.
  const releaseFn = useRef<(dir: 1 | -1 | 0, v: number) => void>(() => {});

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const mq = window.matchMedia("(max-width: 639.98px)");
    const sync = () => {
      stepModeRef.current = mq.matches;
      setStepMode(mq.matches);
      lastStep.current = performance.now();
      // Come to rest on the slide nearest the middle.
      if (mq.matches) stepFn.current(0, true);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(vp);
    mq.addEventListener("change", sync);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, []);

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

    const slot = () => {
      const first = firstSet.current?.firstElementChild as HTMLElement | null;
      const width = first?.offsetWidth ?? 280;
      // `centred`: the offset that puts a slide's centre on the strip's.
      return { unit: width + gap, centred: -(vp.clientWidth - width) / 2 };
    };

    // Send the strip `distance` px further, on the spring (or at once).
    const travel = (distance: number, instant: boolean, v?: number) => {
      lastStep.current = performance.now();
      if (reducedRef.current || instant) {
        offset.current += distance;
        spring.current = { left: 0, v: 0 };
        return;
      }
      spring.current = { left: distance, v: v ?? spring.current.v };
    };

    const doStep = (dir: 1 | -1 | 0, instant = false) => {
      const { unit, centred } = slot();
      if (!stepModeRef.current) return travel(spring.current.left + dir * unit, instant);
      // The cover nearest where the strip is heading, plus `dir` covers —
      // so every stop shows one whole cover, centred.
      const heading = offset.current + spring.current.left;
      const target = Math.round((heading - centred) / unit) * unit + centred + dir * unit;
      travel(target - offset.current, instant);
    };

    // A swipe let go: on to the next cover in the direction it went (or back
    // to the nearest, for a touch that hardly moved), keeping its speed.
    const release = (dir: 1 | -1 | 0, v: number) => {
      const { unit, centred } = slot();
      const k = (offset.current - centred) / unit;
      const index = dir > 0 ? Math.ceil(k - 0.05) : dir < 0 ? Math.floor(k + 0.05) : Math.round(k);
      travel(index * unit + centred - offset.current, false, v);
    };

    stepFn.current = doStep;
    releaseFn.current = release;
    if (stepModeRef.current) doStep(0, true);

    let raf = 0;
    let last = performance.now();
    // The spring's stiffness: critically damped, it settles in about 0.7s.
    // Its push is capped, so a jump builds up over a few frames instead of
    // setting off at a kick.
    const OMEGA = 9;
    const MAX_ACCEL = 9000;
    // How long a phone holds a cover it was moved to before gliding again,
    // and how long the glide takes to come back up to speed.
    const HOLD_MS = 3500;
    const RAMP_MS = 900;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      const stepping = stepModeRef.current;
      const setWidth = set.offsetWidth + gap;
      const sp = spring.current;
      const moving = sp.left !== 0;

      const free =
        playingRef.current &&
        !held.current &&
        !drag.current &&
        visible.current &&
        !document.hidden &&
        !reducedRef.current;
      // A phone holds still while a jump lands and for HOLD_MS after.
      if (stepping && (moving || drag.current)) lastStep.current = now;
      const since = now - lastStep.current;
      if (free && (!stepping || since > HOLD_MS)) {
        // Ease back up to speed rather than lurching off.
        const ramp = stepping ? Math.min((since - HOLD_MS) / RAMP_MS, 1) : 1;
        offset.current += speed * dt * (ramp * ramp * (3 - 2 * ramp));
      }

      if (moving) {
        const accel = OMEGA * OMEGA * sp.left - 2 * OMEGA * sp.v;
        sp.v += Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, accel)) * dt;
        let move = sp.v * dt;
        if (Math.abs(move) > Math.abs(sp.left)) move = sp.left;
        offset.current += move;
        sp.left -= move;
        if (Math.abs(sp.left) < 0.5 && Math.abs(sp.v) < 20) {
          offset.current += sp.left;
          spring.current = { left: 0, v: 0 };
        }
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

  const step = (dir: 1 | -1) => stepFn.current(dir);

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
      // Held by a real mouse or by keyboard focus only. A tap on a phone
      // also fires "mouse enter" and focuses the button, and neither ever
      // ends on a touch screen — so honouring them froze the strip for good
      // after one tap on an arrow.
      onPointerEnter={(e) => (held.current = e.pointerType === "mouse")}
      onPointerLeave={() => (held.current = false)}
      onFocus={(e) => (held.current = e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) held.current = false;
      }}
    >
      {/* Above the strip, so they are seen before the covers (owner,
          2026-10-28) — on a phone the covers fill the screen. */}
      <div className="mb-6 flex items-center justify-end gap-2">
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
      {/* Before hydration this is an ordinary scrollable row; once the loop
          owns the transform, scrolling is switched off so the two never fight. */}
      <div
        ref={viewport}
        className={cn(ready ? "overflow-hidden" : "overflow-x-auto", stepMode && "touch-pan-y")}
        // The strip follows the finger, then settles on the nearest cover —
        // or the next one along, for a short flick. The gesture is locked to
        // its first clear direction: a page scroll that crosses the strip
        // drifts sideways too, and must never turn into a swipe (owner,
        // 2026-10-27).
        onTouchStart={(e) => {
          if (!stepMode) return;
          const t = e.touches[0];
          drag.current = {
            x: t.clientX,
            y: t.clientY,
            base: offset.current,
            axis: null,
            lastX: t.clientX,
            lastT: e.timeStamp,
            vx: 0,
          };
        }}
        onTouchMove={(e) => {
          const d = drag.current;
          if (!d || d.axis === "y") return;
          const t = e.touches[0];
          const dx = t.clientX - d.x;
          if (d.axis === null) {
            const dy = t.clientY - d.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
            d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (d.axis === "y") return;
            // Take hold where the strip is now, mid-jump or not.
            spring.current = { left: 0, v: 0 };
            d.base = offset.current + dx;
          }
          offset.current = d.base - dx;
          const ms = e.timeStamp - d.lastT;
          if (ms > 0) d.vx = 0.6 * d.vx + 0.4 * (((t.clientX - d.lastX) / ms) * 1000);
          d.lastX = t.clientX;
          d.lastT = e.timeStamp;
        }}
        onTouchEnd={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.axis !== "x") return;
          const dx = e.changedTouches[0].clientX - d.x;
          // Finger left = strip forward. A drag of a few px is a slip; a
          // fast flick counts however short.
          const fast = Math.abs(d.vx) > 250;
          const dir = Math.abs(dx) > 24 || fast ? (dx < 0 ? 1 : -1) : 0;
          releaseFn.current(dir, -d.vx);
        }}
        onTouchCancel={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.axis === "x") releaseFn.current(d.lastX < d.x ? 1 : d.lastX > d.x ? -1 : 0, -d.vx);
        }}
      >
        <div ref={track} className="flex w-max will-change-transform" style={{ gap }}>
          {set(false)}
          {ready ? set(true) : null}
        </div>
      </div>

    </section>
  );
}
