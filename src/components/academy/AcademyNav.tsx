"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { academyNavigation, isActive, isCurrentPage } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Academy workspace navigation — note 04 §9, §11, §16.1.
 *
 * Two arrangements of the same list, as `AccountNav` has:
 *
 *   lg and up   a sticky sidebar, each item with its icon
 *   below lg    the same list in the header's hamburger menu, a sheet
 *               sliding in from the left (`WorkspaceDrawer`, note 04 §32.4)
 *
 * The phone arrangement was first a horizontally scrolling strip of links
 * under the header (the secondary link bar note 04 §27 rejects), then a
 * full-width section button above the page, which cost a phone too much
 * height (owner, 2026-10-15).
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
  "/academy/pass": (
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  ),
  "/academy/playlists": (
    <>
      <path d="M4 6h11M4 11h11M4 16h7" />
      <path d="m16 13 5 3-5 3z" />
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

/**
 * `sidebar` is the lg-and-up column; `drawer` is the same list inside the
 * header's `WorkspaceDrawer` below lg. The layout shows each at its width.
 */
export function AcademyNav({ variant = "sidebar" }: { variant?: "sidebar" | "drawer" }) {
  const pathname = usePathname();
  const activeHref = activeHrefFor(pathname);

  return (
    <nav aria-label="Academy">
      <Items pathname={pathname} activeHref={activeHref} />
      <div className={cn("border-t border-border", variant === "sidebar" ? "mt-8 pt-6" : "mt-4 pt-4")}>
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
  );
}

function Items({
  pathname,
  activeHref,
}: {
  pathname: string;
  activeHref: string | undefined;
}) {
  return (
    <ul className="space-y-0.5">
      {academyNavigation.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
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
