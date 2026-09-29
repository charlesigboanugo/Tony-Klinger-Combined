"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * A thin bar across the top while an in-app navigation is loading (note 10 §47.2).
 *
 * Client-side navigation never turns the browser's own spinner, so a click on
 * a page that is not ready yet looked like a pause. This restores the cue.
 *
 * DRIVEN DIRECTLY, NOT THROUGH REACT STATE. The next page is rendered in a
 * React transition, and on a phone a state update made during it was only
 * committed together with the new page — the bar appeared after the pause it
 * was meant to cover. So the click handler sets `data-state` on the element
 * itself, and CSS does the rest (`.nav-progress` in globals.css): hidden for
 * the first 100 ms so an instant navigation never flashes it, then creeping
 * towards 85%, and filling and fading once the URL changes. A 12 s cap clears
 * it if a navigation never lands. Transform and opacity only.
 *
 * Mounted once in the root layout, so it covers every area.
 */
const SHOW_AFTER_MS = 100; // keep in step with the animation delay in globals.css
const GIVE_UP_MS = 12_000;

function internalTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return null;
  const target = url.pathname + url.search;
  // Same page, or only a #fragment away: nothing will load.
  return target === location.pathname + location.search ? null : target;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const target = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const frame = useRef(0);
  const started = useRef(0);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    cancelAnimationFrame(frame.current);
  }, []);

  const finish = useCallback(() => {
    const el = bar.current;
    if (!target.current || !el) return;
    target.current = null;
    clear();
    // Arrived before the bar ever showed: stay invisible rather than flash it.
    if (performance.now() - started.current < SHOW_AFTER_MS) {
      el.dataset.state = "idle";
      return;
    }
    el.dataset.state = "done";
    timers.current.push(window.setTimeout(() => (el.dataset.state = "idle"), 400));
  }, [clear]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const next = internalTarget(event);
      const el = bar.current;
      if (!next || !el) return;
      clear();
      target.current = next;
      // Restart the animation from the start even if a bar is still showing.
      el.dataset.state = "idle";
      void el.offsetWidth;
      el.dataset.state = "loading";
      started.current = performance.now();
      timers.current.push(window.setTimeout(finish, GIVE_UP_MS));
      // A query-only navigation (a filter) does not change the pathname, so
      // the URL itself is watched too.
      const watch = () => {
        if (target.current && location.pathname + location.search === target.current) finish();
        else if (target.current) frame.current = requestAnimationFrame(watch);
      };
      frame.current = requestAnimationFrame(watch);
    };
    // Capture phase: runs before next/link handles (and prevents) the click.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, [clear, finish]);

  // The new page has arrived.
  useEffect(() => {
    finish();
  }, [pathname, finish]);

  return <div ref={bar} aria-hidden="true" data-state="idle" className="nav-progress" />;
}
