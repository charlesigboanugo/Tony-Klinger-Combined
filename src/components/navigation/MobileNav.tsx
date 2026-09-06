"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ExternalMark } from "@/components/navigation/ExternalMark";
import { ButtonLink } from "@/components/ui/Button";
import { isActive, isCurrentPage, publicNavigation, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Mobile and tablet navigation — note 04 §26, §27, note 10 §31, §35.
 *
 * A full-height sheet rather than a list pushed under the header. The previous
 * version expanded every submenu at once, which on a phone put around thirty
 * links in a single scroll and buried the primary items.
 *
 * What a menu of this kind has to get right, and what each costs if missed:
 *
 *   Accordion sections   Seven top-level items are visible at once instead of
 *                        thirty links. Sections open one at a time.
 *   Focus trap           Tab must not walk out of an open sheet into the page
 *                        behind it, which a sighted keyboard user cannot see.
 *   Escape to close      Expected of any modal surface.
 *   Scroll lock          Without it the page behind scrolls under the sheet and
 *                        the reader loses their place on close.
 *   Focus restoration    Focus returns to the toggle, not to <body>.
 *   Large hit targets    44px minimum, per note 10 §35.
 *
 * The route change itself closes the sheet — handled by the caller, which
 * watches `pathname`.
 */
export function MobileNav({
  open,
  onClose,
  userEmail,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  userEmail?: string | null;
  pathname: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Which section is expanded. Defaults to the one containing the current page,
  // so the menu opens already showing where the reader is.
  const [expanded, setExpanded] = useState<string | null>(() => {
    const current = publicNavigation.find((item) =>
      (item.children ?? []).some(
        (child) => !child.external && isActive(pathname, child.href),
      ),
    );
    return current?.href ?? null;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Scroll lock. The scrollbar's width is compensated so the page behind does
    // not visibly shift as it disappears.
    const { body } = document;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      // Focus trap. Without it, Tab leaves the sheet and walks the page behind,
      // which a keyboard user cannot see is still there.
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", onKeyDown);

    // Move focus into the sheet so the first Tab lands inside it.
    sheetRef.current
      ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      ?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden">
      {/* Scrim. Clicking it closes, which is the gesture most people try first. */}
      <div
        className="fixed inset-0 top-16 z-40 bg-black/40 motion-safe:animate-[nav-fade_160ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={cn(
          "fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto overscroll-contain",
          "border-t border-border bg-background",
          "motion-safe:animate-[nav-sheet_200ms_cubic-bezier(0.32,0.72,0,1)]",
        )}
      >
        <nav aria-label="Main" className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <ul className="space-y-1">
            {publicNavigation.map((item) =>
              item.children?.length ? (
                <MobileSection
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  expanded={expanded === item.href}
                  onToggle={() =>
                    setExpanded((current) =>
                      current === item.href ? null : item.href,
                    )
                  }
                  onNavigate={onClose}
                />
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-(--radius) px-3 text-base transition-colors",
                      isActive(pathname, item.href)
                        ? "bg-surface-muted font-medium text-foreground"
                        : "text-foreground/80 hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>

          <div className="mt-6 grid gap-2 border-t border-border pt-6 sm:grid-cols-2">
            <ButtonLink href="/cart" variant="outline" onClick={onClose}>
              Cart
            </ButtonLink>
            {userEmail ? (
              <ButtonLink href="/account" onClick={onClose}>
                My account
              </ButtonLink>
            ) : (
              <ButtonLink href="/auth/sign-in" onClick={onClose}>
                Sign in
              </ButtonLink>
            )}
          </div>

          {userEmail ? (
            <p className="mt-4 truncate px-3 text-sm text-muted-foreground">
              Signed in as {userEmail}
            </p>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

function MobileSection({
  item,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const sectionActive =
    isActive(pathname, item.href) ||
    (item.children ?? []).some(
      (child) => !child.external && isActive(pathname, child.href),
    );

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex min-h-11 w-full items-center justify-between rounded-(--radius) px-3 text-base transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          sectionActive
            ? "bg-surface-muted font-medium text-foreground"
            : "text-foreground/80 hover:bg-surface-muted",
        )}
      >
        {item.label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn(
            "h-3 w-3 opacity-60 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        >
          <path
            d="M2 4.5 6 8.5 10 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded ? (
        <ul className="mt-1 ml-3 space-y-0.5 border-l border-border pl-3">
          {(item.children ?? []).map((child) => {
            const childActive = !child.external && isActive(pathname, child.href);

            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  {...(child.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  onClick={onNavigate}
                  aria-current={isCurrentPage(pathname, child.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-3 rounded-(--radius) px-3 text-sm transition-colors",
                    childActive
                      ? "bg-surface-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <span>{child.label}</span>
                  {child.external ? <ExternalMark /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
