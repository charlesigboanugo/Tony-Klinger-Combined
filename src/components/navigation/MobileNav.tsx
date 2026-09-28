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
 * A full-screen takeover on the ink field (note 10 §42.2): numbered sections
 * set large in the display face, rising in one after another, with Sign in
 * (or the account) and the cart at the foot. A full-height sheet rather than a
 * list pushed under the header. The previous
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
  cartCount = 0,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  userEmail?: string | null;
  cartCount?: number;
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

  // Entries rise in one after another; capped so the last never lags.
  const rise = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 45}ms` });

  return (
    <div className="lg:hidden">
      <div
        ref={sheetRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={cn(
          // A full-screen takeover on the ink field (note 10 §42.2), not a
          // sheet over a scrim: the menu IS the screen while it is open.
          "on-ink grain fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto overscroll-contain",
          "motion-safe:animate-[nav-fade_200ms_ease-out]",
        )}
      >
        <nav aria-label="Main" className="mx-auto flex min-h-full max-w-2xl flex-col px-5 pt-6 pb-10 sm:px-8">
          <ol className="border-t border-border">
            {publicNavigation.map((item, i) => (
              <li
                key={item.href}
                style={rise(i)}
                className="border-b border-border motion-safe:animate-[menu-rise_420ms_cubic-bezier(0.16,1,0.3,1)_both]"
              >
                {item.children?.length ? (
                  <MobileSection
                    item={item}
                    number={i + 1}
                    pathname={pathname}
                    expanded={expanded === item.href}
                    onToggle={() => setExpanded((current) => (current === item.href ? null : item.href))}
                    onNavigate={onClose}
                  />
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                    className="group flex min-h-16 items-baseline gap-4 py-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <SectionNumber n={i + 1} />
                    <span
                      className={cn(
                        "font-display text-[2rem] leading-none font-semibold tracking-tight transition-colors sm:text-4xl",
                        isActive(pathname, item.href) ? "text-foreground" : "text-foreground/85 group-hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </span>
                    {isActive(pathname, item.href) ? (
                      <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 self-center rounded-full bg-primary" />
                    ) : null}
                  </Link>
                )}
              </li>
            ))}
          </ol>

          <div
            style={rise(publicNavigation.length)}
            className="mt-auto grid gap-3 pt-10 motion-safe:animate-[menu-rise_420ms_cubic-bezier(0.16,1,0.3,1)_both] sm:grid-cols-2"
          >
            {userEmail ? (
              <ButtonLink href="/account" variant="onBlock" onClick={onClose}>
                My account
              </ButtonLink>
            ) : (
              <ButtonLink href="/auth/sign-in" variant="onBlock" onClick={onClose}>
                Sign in
              </ButtonLink>
            )}
            <ButtonLink href="/cart" variant="onBlockOutline" onClick={onClose}>
              {cartCount > 0 ? `Cart (${cartCount})` : "Cart"}
            </ButtonLink>
          </div>

          {userEmail ? (
            <p className="mt-4 truncate text-center text-xs text-muted-foreground">Signed in as {userEmail}</p>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

/** "01" — the catalogue's numbering, carried into the menu. */
function SectionNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="w-7 shrink-0 text-xs text-muted-foreground tabular-nums">
      {String(n).padStart(2, "0")}
    </span>
  );
}

function MobileSection({
  item,
  number,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  number: number;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const sectionActive =
    isActive(pathname, item.href) ||
    (item.children ?? []).some((child) => !child.external && isActive(pathname, child.href));

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group flex min-h-16 w-full items-baseline gap-4 py-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
      >
        <SectionNumber n={number} />
        <span
          className={cn(
            "font-display text-[2rem] leading-none font-semibold tracking-tight transition-colors sm:text-4xl",
            sectionActive || expanded ? "text-foreground" : "text-foreground/85 group-hover:text-foreground",
          )}
        >
          {item.label}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "ml-auto grid h-8 w-8 shrink-0 place-items-center self-center rounded-full border border-border transition-transform duration-(--dur-base) ease-expo",
            expanded && "rotate-45 border-foreground",
          )}
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path d="M6 1.5v9M1.5 6h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {expanded ? (
        <div className="pb-6 pl-11 motion-safe:animate-[nav-in_200ms_ease-out]">
          {item.description ? (
            <p className="mb-3 max-w-md text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          ) : null}
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {(item.children ?? []).map((child) => {
              const childActive = !child.external && isActive(pathname, child.href);

              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    {...(child.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    onClick={onNavigate}
                    aria-current={isCurrentPage(pathname, child.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 text-base transition-colors",
                      childActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {childActive ? <span aria-hidden="true" className="h-px w-3 bg-primary" /> : null}
                    <span>{child.label}</span>
                    {child.external ? <ExternalMark className="inline-block h-3 w-3 opacity-70" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}
