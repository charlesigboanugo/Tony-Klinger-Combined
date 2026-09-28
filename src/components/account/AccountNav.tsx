"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { accountNavigation, isActive, isCurrentPage } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Account navigation — note 04 §12, §31.
 *
 * Built the same way as `AcademyNav`, at the owner's request (2026-09-26): one
 * flat list, an icon beside each item, no group headings.
 *
 *   lg and up   a sticky sidebar
 *   below lg    one full-width button naming the current section, opening the
 *               list as a dropdown panel — not a strip of links under the
 *               masthead, which the owner rejected (note 04 §27)
 *
 * The active state is teal (`--accent`: action and state, note 10 §5); the
 * phone button's disc is oxblood, Account's identity colour, where Academy's
 * is noir.
 *
 * Exactly ONE item lights up, resolved by longest matching href: "/account" is
 * a URL-prefix of every other item purely as a side effect of routing. Pages
 * with no item of their own borrow their parent's — a ticket lives under
 * Bookings, a claimed purchase under Orders.
 */
const ICONS: Record<string, ReactNode> = {
  "/account": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  "/account/entitlements": (
    <>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H21M17 12v3M20 12v2" />
    </>
  ),
  "/account/bookings": (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  "/account/memberships": (
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  "/account/orders": (
    <>
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  "/account/billing": (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  "/account/profile": (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
  "/account/security": (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  "/account/notifications": (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  "/account/settings": (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
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

const BORROWED: Array<[prefix: string, href: string]> = [
  ["/account/tickets", "/account/bookings"],
  ["/account/claim", "/account/orders"],
];

function activeHrefFor(pathname: string) {
  const borrowed = BORROWED.find(([prefix]) => isActive(pathname, prefix));
  if (borrowed) return borrowed[1];
  return accountNavigation
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AccountNav() {
  const pathname = usePathname();
  const activeHref = activeHrefFor(pathname);
  const activeLabel = accountNavigation.find((i) => i.href === activeHref)?.label ?? "Account";

  return (
    <>
      <div className="lg:hidden">
        <SectionSwitcher pathname={pathname} activeHref={activeHref} activeLabel={activeLabel} />
      </div>

      <nav aria-label="Account" className="hidden lg:block">
        <Items pathname={pathname} activeHref={activeHref} />
        <div className="mt-8 border-t border-border pt-6">
          <p className="px-3 text-xs leading-relaxed text-muted-foreground">
            Ready to learn?
          </p>
          <Link
            href="/academy"
            className="mt-1 inline-block px-3 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Go to the Academy
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
      {accountNavigation.map((item) => (
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

  // Close on navigation — adjusting state during render, as PublicHeader does.
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
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-block-oxblood text-block-foreground"
        >
          {activeHref ? <NavIcon href={activeHref} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Your account
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
          aria-label="Account"
          className="max-h-[70svh] overflow-y-auto overscroll-contain rounded-(--radius-lg) border border-border bg-surface p-3 shadow-lift"
        >
          <Items pathname={pathname} activeHref={activeHref} onNavigate={() => setOpen(false)} />
          <Link
            href="/academy"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-2 border-t border-border px-3 pt-3 pb-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Go to the Academy <span aria-hidden="true">&rarr;</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
