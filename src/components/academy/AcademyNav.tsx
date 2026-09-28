"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { academyNavigation, isActive, isCurrentPage } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Academy workspace navigation — note 04 §9, §11, §16.1.
 *
 * Two arrangements of the same list, as `AccountNav` has:
 *
 *   lg and up   a sticky sidebar, each item with its icon
 *   below lg    one full-width button naming the current section, opening the
 *               list as a dropdown panel
 *
 * The phone arrangement used to be a horizontally scrolling strip of links
 * under the header — exactly the secondary link bar the owner rejected (note
 * 04 §27). One button that says where you are is also what a phone has room
 * for.
 *
 * The active state is teal (`--accent`: action and state, note 10 §5).
 * Exactly ONE item lights up, resolved by longest matching href: "/academy" is
 * a URL-prefix of every other item purely as a side effect of routing, not
 * because Dashboard is their parent.
 */
const ICONS: Record<string, ReactNode> = {
  "/academy": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  "/academy/courses": (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="m10 9 5 2.5-5 2.5z" />
    </>
  ),
  "/academy/cohorts": (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M15 14.5c2.8 0 5 1.3 5 4.5" />
    </>
  ),
  "/academy/coaching": (
    <>
      <path d="M4 5h16v10H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
};

function NavIcon({ href }: { href: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4.5 w-4.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[href]}
    </svg>
  );
}

function activeHrefFor(pathname: string) {
  return academyNavigation
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AcademyNav() {
  const pathname = usePathname();
  const activeHref = activeHrefFor(pathname);
  const activeLabel = academyNavigation.find((i) => i.href === activeHref)?.label ?? "Academy";

  return (
    <>
      <div className="lg:hidden">
        <SectionSwitcher pathname={pathname} activeHref={activeHref} activeLabel={activeLabel} />
      </div>

      <nav aria-label="Academy" className="hidden lg:block">
        <Items pathname={pathname} activeHref={activeHref} />
        <div className="mt-8 border-t border-border pt-6">
          <p className="px-3 text-xs leading-relaxed text-muted-foreground">
            Looking for something new?
          </p>
          <Link
            href="/coaching"
            className="mt-1 inline-block px-3 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Explore coaching
          </Link>
        </div>
      </nav>
    </>
  );
}

function Items({
  pathname,
  activeHref,
  onNavigate,
}: {
  pathname: string;
  activeHref: string | undefined;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {academyNavigation.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-(--radius) border-l-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              item.href === activeHref
                ? "border-accent bg-accent/10 font-medium text-accent"
                : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <NavIcon href={item.href} />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Same outside-click / Escape / focus-restore contract as `UserMenu`, and the
 * shared `.dropdown-panel` motion so it animates both ways (note 10 §37.1).
 */
function SectionSwitcher({
  pathname,
  activeHref,
  activeLabel,
}: {
  pathname: string;
  activeHref: string | undefined;
  activeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on navigation — adjusting state during render, as AccountNav does.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex w-full items-center gap-3 rounded-(--radius-lg) border bg-surface p-2.5 pr-4 text-left shadow-card transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          open ? "border-accent" : "border-border hover:border-foreground/40",
        )}
      >
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-block-noir text-block-foreground">
          {activeHref ? <NavIcon href={activeHref} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Academy
          </span>
          <span className="block truncate text-sm font-medium">{activeLabel}</span>
        </span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        id={panelId}
        aria-hidden={!open}
        data-open={open}
        className="dropdown-panel absolute inset-x-0 z-30 mt-2 origin-top"
      >
        <nav
          aria-label="Academy"
          className="max-h-[70svh] overflow-y-auto overscroll-contain rounded-(--radius-lg) border border-border bg-surface p-3 shadow-lift"
        >
          <Items pathname={pathname} activeHref={activeHref} onNavigate={() => setOpen(false)} />
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-2 border-t border-border px-3 pt-3 pb-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden="true">&larr;</span> Back to site
          </Link>
        </nav>
      </div>
    </div>
  );
}
