"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ExternalMark } from "@/components/navigation/ExternalMark";
import { navLinkType } from "@/components/navigation/navStyles";
import { isActive, isCurrentPage, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Desktop submenu — note 04 §5, §38, note 10 §35.
 *
 * Note 04 defines submenus for Coaching, Catalogue and (per note 11)
 * Give-Get-Go, but the desktop header previously rendered only top-level items:
 * `children` was read solely by the mobile menu, so every submenu was
 * unreachable above the `lg` breakpoint.
 *
 * KEYBOARD AND POINTER BOTH WORK, and neither traps the other:
 *
 *   - Hover opens it, because that is what a pointer user expects, but hover
 *     alone would strand keyboard and touch users.
 *   - The trigger is a real <button> with `aria-expanded`, so Enter and Space
 *     open it and a screen reader announces the state.
 *   - Escape closes and returns focus to the trigger, so the menu can never
 *     swallow the keyboard.
 *   - A click outside closes it.
 *
 * The parent destination stays reachable: the first child is always the section
 * overview, so opening the menu never hides the page the label refers to.
 */
export function NavDropdown({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // A section is current when any of its pages is, so "Coaching" stays
  // highlighted while reading /coaching/memberships.
  const sectionActive =
    isActive(pathname, item.href) ||
    (item.children ?? []).some(
      (child) => !child.external && isActive(pathname, child.href),
    );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus must go back to the trigger, or it lands on <body> and the next
      // Tab restarts from the top of the page.
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
    <li
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-current={sectionActive ? "true" : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-2 py-3 transition-colors xl:px-3",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          navLinkType,
          sectionActive || open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {item.label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn(
            "h-2.5 w-2.5 transition-transform duration-200",
            open && "rotate-180",
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

      {/* Kept mounted always — `dropdown-panel` (note 10 §37.1) needs the
          element present in both directions to animate the close, which
          `hidden`/display:none cannot do. `aria-hidden` plus the panel's own
          `visibility`/`pointer-events` keep it out of the tab order and
          unclickable while closed. */}
      {/* THE PANEL — note 10 §42.2. The header's paper surface, the section
          named in the display face with a line on what it holds, and its
          links beside that. Centred under its trigger by an outer wrapper, so
          the `dropdown-panel` transform (note 10 §37.1) is not overridden by a
          translate on the same element.

          Kept mounted always — `dropdown-panel` needs the element present in
          both directions to animate the close, which `hidden`/display:none
          cannot do. `aria-hidden` plus the panel's own `visibility` and
          `pointer-events` keep it out of the tab order and unclickable while
          closed. */}
      {/* The wrapper is as large as the panel even while the panel is hidden,
          and it's inside the <li>, so it must ignore the pointer when closed:
          otherwise hovering the empty page below the header opens the menu.
          Open, it catches the pointer so the `pt-3` gap bridges trigger and
          panel without a mouseleave. */}
      {/* FLUSH WITH THE HEADER'S BOTTOM EDGE (owner, 2026-09-24): the panel
          reads as the masthead folding open, not a box dropped under it. The
          trigger is vertically centred in the 4.5rem (`lg:h-18`) bar, so the
          bar's bottom edge is always 50% + 2.25rem below the trigger's top,
          whatever the trigger's own height. The `before:` strip bridges the
          gap between trigger and panel, so moving the pointer down never
          leaves the <li> and closes the menu. */}
      <div
        className={cn(
          "absolute top-[calc(50%+2.25rem)] left-1/2 z-50 -translate-x-1/2",
          "before:absolute before:inset-x-0 before:bottom-full before:h-6",
          !open && "pointer-events-none",
        )}
      >
        <div
          id={menuId}
          aria-hidden={!open}
          data-open={open}
          className="dropdown-panel origin-center"
        >
          <div
            className={cn(
              // The header's own paper, squared off where it meets the bar
              // and rounded below. Solid, not the bar's translucent blur: a
              // panel this size let the page's headlines ghost through it.
              // A hairline and the lift shadow keep it a layer above the page,
              // light or dark, including over the noir home hero.
              "relative grid gap-8 overflow-hidden rounded-b-(--radius-lg) border border-border bg-background p-7 shadow-lift",
              (item.children ?? []).length > 5
                ? "w-160 grid-cols-[14rem_minmax(0,1fr)]"
                : "w-xl grid-cols-[14rem_minmax(0,1fr)]",
            )}
          >
            {/* A short red rule under the bar, centred on the trigger above:
                the thread from the word you pointed at to its menu. */}
            <span aria-hidden="true" className="absolute top-0 left-1/2 h-0.5 w-10 -translate-x-1/2 bg-primary" />
            <div className="border-r border-border pr-8">
              {/* Never breaks at a hyphen: "Give-Get-Go" is one name. */}
              <p className="font-display text-3xl leading-none font-semibold tracking-tight whitespace-nowrap">{item.label}</p>
              {item.description ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              ) : null}
            </div>

            <ul
              className={cn(
                "grid content-start gap-x-6 gap-y-0.5",
                (item.children ?? []).length > 5 && "grid-cols-2",
              )}
            >
              {(item.children ?? []).map((child) => {
                const childActive = !child.external && isActive(pathname, child.href);

                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      {...(child.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      onClick={() => setOpen(false)}
                      aria-current={isCurrentPage(pathname, child.href) ? "page" : undefined}
                      className={cn(
                        "group/item flex items-center gap-2 rounded-sm py-2 text-sm transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        childActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-px w-3 origin-left bg-primary transition-transform duration-(--dur-base) ease-expo",
                          childActive ? "scale-x-100" : "scale-x-0 group-hover/item:scale-x-100",
                        )}
                      />
                      <span>{child.label}</span>
                      {child.external ? <ExternalMark className="inline-block h-3 w-3 opacity-70" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </li>
  );
}
