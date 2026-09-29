"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A thin bar across the top while an in-app navigation is loading (note 10 §47.2).
 *
 * Client-side navigation never turns the browser's own spinner, so a click on
 * a page that is not ready yet looked like a pause. This restores the cue.
 *
 *   - starts on a click on an internal link, but only SHOWS after 100 ms, so an
 *     instant (prefetched) navigation never flashes it
 *   - creeps towards 85% while waiting, then completes and fades when the URL
 *     changes; a 12 s cap clears it if a navigation never lands
 *   - transform and opacity only, so it costs nothing to animate
 *
 * Mounted once in the root layout, so it covers every area.
 */
const SHOW_AFTER_MS = 100;
const GIVE_UP_MS = 12_000;

type Phase = "idle" | "waiting" | "loading" | "done";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const target = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (!target.current) return;
    target.current = null;
    clearTimers();
    setPhase((p) => (p === "loading" ? "done" : "idle"));
    timers.current.push(window.setTimeout(() => setPhase("idle"), 450));
  }, [clearTimers]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const next = internalTarget(event);
      if (!next) return;
      clearTimers();
      target.current = next;
      setPhase("waiting");
      timers.current.push(
        window.setTimeout(() => target.current && setPhase("loading"), SHOW_AFTER_MS),
        window.setTimeout(finish, GIVE_UP_MS),
      );
    };
    // Capture phase: runs before next/link handles (and prevents) the click.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [clearTimers, finish]);

  // The new page has arrived. A query-only navigation (a filter) does not
  // change the pathname, so the URL is also checked on each frame while waiting.
  useEffect(() => {
    finish();
  }, [pathname, finish]);

  useEffect(() => {
    if (phase !== "waiting" && phase !== "loading") return;
    let frame = 0;
    const check = () => {
      if (target.current && location.pathname + location.search === target.current) finish();
      else frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [phase, finish]);

  if (phase === "idle" || phase === "waiting") return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.75">
      <div
        className={
          phase === "done"
            ? "h-full origin-left bg-accent opacity-0 transition-[transform,opacity] duration-300 ease-out"
            : "h-full origin-left animate-[nav-progress_8s_cubic-bezier(0.1,0.8,0.2,1)_forwards] bg-accent shadow-[0_0_8px_var(--accent)]"
        }
      />
    </div>
  );
}
