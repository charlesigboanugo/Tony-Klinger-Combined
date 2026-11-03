"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ExternalMark } from "@/components/navigation/ExternalMark";
import { SignOutForm } from "@/components/navigation/SignOutForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import { isActive, isCurrentPage, publicNavigation, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Mobile and tablet navigation — note 04 §26, §27, note 10 §31, §35.
 *
 * A full-screen takeover on the ink field (note 10 §42.2): numbered sections
 * in the display face, rising in one after another, their links set as links
 * (indented on a guide line, with an arrow), with Sign in
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
  admin = false,
  cartCount = 0,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  userEmail?: string | null;
  /** The account holds a staff role, so the foot offers Admin too. */
  admin?: boolean;
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

  // The featured destination (Coaching) first on a phone (Tony, 2026-11-02);
  // the rest keep the masthead's order.
  const menuOrder = [
    ...publicNavigation.filter((item) => item.featured),
    ...publicNavigation.filter((item) => !item.featured),
  ];

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
          {/* Signed in, the account sits ABOVE the menu as one small panel
              (owner, 2026-11-03): who is signed in, then Admin for staff on a
              line of its own and Academy and My account side by side, all as
              matching tiles so no one of them shouts. Cart and Sign out pair up
              at the foot. */}
          {userEmail ? (
            <div className="mb-6 rounded-(--radius-lg) border border-border bg-foreground/5 p-3 motion-safe:animate-[menu-rise_420ms_cubic-bezier(0.16,1,0.3,1)_both]">
              <p className="truncate px-1 text-xs text-muted-foreground">
                Signed in as <span className="text-foreground">{userEmail}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {admin ? (
                  <Link href="/admin" onClick={onClose} className={cn(tile, "col-span-2")}>
                    Admin
                  </Link>
                ) : null}
                <Link href="/academy" onClick={onClose} className={tile}>
                  Academy
                </Link>
                <Link href="/account" onClick={onClose} className={tile}>
                  My account
                </Link>
              </div>
            </div>
          ) : null}
          <ol className="border-t border-border">
            {menuOrder.map((item, i) => (
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
                    className="group flex min-h-14 items-baseline gap-4 py-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <SectionNumber n={i + 1} />
                    <span
                      className={cn(
                        "font-display text-xl leading-tight font-semibold tracking-tight transition-colors sm:text-2xl",
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
            className="mt-auto grid grid-cols-2 gap-3 pt-10 motion-safe:animate-[menu-rise_420ms_cubic-bezier(0.16,1,0.3,1)_both]"
          >
            {userEmail ? null : (
              <ButtonLink href="/auth/sign-in" variant="onBlock" onClick={onClose} className="w-full">
                Sign in
              </ButtonLink>
            )}
            <ButtonLink href="/cart" variant="onBlockOutline" onClick={onClose} className="w-full">
              {cartCount > 0 ? `Cart (${cartCount})` : "Cart"}
            </ButtonLink>
            {userEmail ? (
              // Sign out, as in the desktop account menu: a POST form, never a
              // link, so no other page can sign someone out.
              // The menu stays open while it works, the button saying so and
              // the top bar running, and closes once signed out.
              <SignOutForm className="grid" onDone={onClose}>
                {(pending) => (
                  <Button type="submit" variant="onBlockOutline" className="w-full" disabled={pending} aria-busy={pending}>
                    {pending ? "Signing out…" : "Sign out"}
                  </Button>
                )}
              </SignOutForm>
            ) : null}
          </div>

        </nav>
      </div>
    </div>
  );
}

/** An account tile in the menu's signed-in panel: all alike, so Admin, Academy
 * and My account read as one set rather than competing buttons. */
const tile = cn(
  "flex h-11 items-center justify-center rounded-(--radius) bg-foreground/8 text-sm font-semibold text-foreground",
  "transition-colors duration-(--dur-fast) hover:bg-foreground/15 active:bg-foreground/20",
  "outline-offset-2 focus-visible:outline-2 focus-visible:outline-white",
);

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
  const panelId = `mobile-nav-${item.href.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="group flex min-h-14 w-full items-baseline gap-4 py-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
      >
        <SectionNumber n={number} />
        <span
          className={cn(
            "font-display text-xl leading-tight font-semibold tracking-tight transition-colors sm:text-2xl",
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

      <div id={panelId} data-open={expanded} className="dropdown-panel dropdown-inline origin-top pb-5 pl-11">
        {item.description ? (
          <p className="mb-2 max-w-md text-xs leading-relaxed text-muted-foreground">{item.description}</p>
        ) : null}
        <ul className="grid border-l border-border sm:grid-cols-2">
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
                    "-ml-px flex min-h-11 items-center gap-3 border-l-2 pr-2 pl-4 text-[0.9375rem] font-medium transition-colors",
                    childActive
                      ? "border-accent text-accent"
                      : "border-transparent text-foreground/90 hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  <span className="flex-1">{child.label}</span>
                  {child.external ? (
                    <ExternalMark className="h-3 w-3 shrink-0 opacity-70" />
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0 opacity-60">
                      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
