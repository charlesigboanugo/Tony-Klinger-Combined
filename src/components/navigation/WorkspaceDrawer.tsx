"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { BackLink } from "@/components/ui/BackLink";
import { cn } from "@/lib/utils/cn";

/**
 * The workspace menu below `lg` — Academy, Account and Admin (note 04 §32.4).
 *
 * A hamburger at the left of the header opens the workspace's own navigation
 * as a sheet sliding in from the left edge over a dimmed page. It replaces the
 * full-width "Academy / Courses" section button that sat above every page
 * (owner, 2026-10-15): that took a whole card's height of the screen on a
 * phone, before any content.
 *
 * Same modal contract as the public `MobileNav`: Escape closes, Tab is trapped
 * in the sheet, the page behind cannot scroll, focus returns to the
 * hamburger. Choosing a link closes it, as does the route changing (the admin
 * finder navigates with `router.push`). Motion is the shared `.dropdown-panel`
 * with the `dropdown-from-left` slide, so it animates both ways (note 10
 * §37.1).
 */
export function WorkspaceDrawer({
  label,
  strip,
  children,
}: {
  /** The workspace's name, at the head of the sheet. */
  label: string;
  /** The workspace's identity colour, for the strip along the sheet's top. */
  strip: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on navigation — adjusting state during render, as the navs do.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
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
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
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

    // A sheet left open while the window widens past `lg` would be invisible
    // and still holding the scroll lock.
    const wide = window.matchMedia("(min-width: 64rem)");
    function onWide() {
      if (wide.matches) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWide);
    sheetRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWide);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={sheetId}
        aria-label={`Open ${label} menu`}
        className={cn(
          "-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors tiny:-ml-1.5 tiny:size-8",
          "hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 tiny:size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div
        aria-hidden="true"
        data-open={open}
        onClick={() => setOpen(false)}
        className="dropdown-scrim fixed inset-0 z-50 bg-black/40"
      />

      <div
        ref={sheetRef}
        id={sheetId}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} menu`}
        data-open={open}
        inert={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) setOpen(false);
        }}
        className="dropdown-panel dropdown-from-left fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col border-r border-border bg-background shadow-lift"
      >
        <div aria-hidden="true" className={cn("h-0.75 w-full shrink-0", strip)} />
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border pr-3 pl-5">
          <span className="text-[0.75rem] font-semibold tracking-[0.24em] uppercase">{label}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">{children}</div>

        <div className="shrink-0 border-t border-border px-5 py-4">
          <BackLink href="/" inline>
            Back to site
          </BackLink>
        </div>
      </div>
    </div>
  );
}
