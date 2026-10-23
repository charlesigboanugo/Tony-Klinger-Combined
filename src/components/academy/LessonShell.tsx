"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The lesson, with the course contents in a bar at the top — at every screen
 * size (owner, 2026-10-15).
 *
 * The bar sits above the lesson and scrolls with it: the way back, the
 * progress and the way to any other lesson.
 * "Course contents" opens the outline as an off-canvas sheet sliding down from
 * under the bar, over the dimmed page. The bar and the sheet are the lesson
 * area's width, not the screen's. It
 * replaced a panel pinned at the right edge on wide screens and a box that
 * expanded inside the page on narrow ones.
 *
 * Closes on Escape, on the dimmed page, on the close button, and on choosing a
 * lesson. While open, the page behind does not scroll and Tab stays inside.
 */
export function LessonShell({
  children,
  back,
  progress,
  outline,
}: {
  children: ReactNode;
  /** The way back to the course. */
  back: ReactNode;
  /** The course progress. */
  progress: ReactNode;
  outline: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // The room between the bar and the foot of the screen, measured when the
  // sheet opens: the bar scrolls with the page, so a fixed height ran the
  // sheet past the bottom and its last lessons could not be reached while
  // the page is held still (owner, 2026-10-15).
  const [room, setRoom] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        toggle.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = sheet.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    // Into the sheet, at the lesson being studied when it is marked.
    (
      sheet.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
      sheet.current?.querySelector<HTMLElement>("a[href], button")
    )?.focus({ preventScroll: true });
    // Bring the current lesson into view by scrolling the SHEET only:
    // `scrollIntoView` also scrolled the page, moving the sheet down past the
    // room measured for it, so its end fell below the screen.
    const panel = sheet.current;
    const current = panel?.querySelector<HTMLElement>('[aria-current="page"]');
    if (panel && current) {
      const offset = current.getBoundingClientRect().top - panel.getBoundingClientRect().top;
      panel.scrollTop += offset - panel.clientHeight / 2;
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  return (
    // The bar, and the sheet that drops from it, are the lesson area's width,
    // not the screen's (owner, 2026-10-15).
    <div>
      {/* The dimmed page; a click on it closes the sheet. Before the bar, at
          the bar's level, so the bar stays above it and the side menu below. */}
      <div
        aria-hidden="true"
        data-open={open}
        onClick={() => setOpen(false)}
        className="dropdown-scrim fixed inset-0 top-16.25 z-30 bg-black/40"
      />

      {/* Scrolls with the page (owner, 2026-10-15); raised above the dimmed
          page so the sheet hanging from it stays clear. */}
      <div ref={barRef} className="relative z-30 mb-8 border-b border-border bg-background py-3">
        {/* Phones and small tablets: the way back has the first row to itself
            (a long course title still fits, shortening only if it must); the
            progress and the contents button share the second. From `md`, all
            three on one row. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap md:gap-x-5">
          <div className="flex min-w-0 basis-full md:basis-auto">{back}</div>
          <div className="flex min-w-0 flex-1 items-center gap-3">{progress}</div>
          <button
            ref={toggle}
            type="button"
            onClick={() => {
              const bottom = barRef.current?.getBoundingClientRect().bottom ?? 0;
              setRoom(Math.max(240, window.innerHeight - bottom - 24));
              setOpen((current) => !current);
            }}
            aria-expanded={open}
            aria-controls="course-contents"
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
            </svg>
            Course contents
          </button>
        </div>

        {/* Hangs from the bar and clips the sheet, so it slides out from under
            the bar rather than over the header. */}
        <div className="pointer-events-none absolute inset-x-0 top-full overflow-hidden pb-6">
          <div
            ref={sheet}
            id="course-contents"
            role="dialog"
            aria-modal="true"
            aria-label="Course contents"
            data-open={open}
            inert={!open}
            // Choosing a lesson leaves this page; the sheet goes with it.
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a[href]")) setOpen(false);
            }}
            style={room ? { maxHeight: room } : undefined}
            className="dropdown-panel dropdown-from-top max-h-[calc(100svh-10rem)] overflow-y-auto overscroll-contain rounded-b-(--radius-lg) border border-t-0 border-border bg-background shadow-card"
          >
            {/* Room under the last lesson, so the end of the list reads as the end. */}
            <div className="px-3 pt-4 pb-10 sm:px-4">
              <div className="mb-4 flex items-center justify-between gap-3 pl-2">
                <p className="text-sm font-semibold">Course contents</p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    toggle.current?.focus();
                  }}
                  className="grid size-9 cursor-pointer place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="sr-only">Close course contents</span>
                  {/* Pointing up, the way the sheet leaves. */}
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 10 5-5 5 5" />
                  </svg>
                </button>
              </div>
              {outline}
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
