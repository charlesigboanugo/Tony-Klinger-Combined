"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ExternalMark } from "@/components/navigation/ExternalMark";
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

  // A section is current when any of its pages is, so "Give-Get-Go" stays
  // highlighted while reading /give-get-go/publishing.
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
          "flex items-center gap-1.5 rounded-(--radius) px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          sectionActive
            ? "bg-surface-muted font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
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
      <div
        id={menuId}
        aria-hidden={!open}
        data-open={open}
        className="dropdown-panel absolute left-0 top-full z-50 min-w-56 origin-top-left pt-2"
      >
        <ul className="overflow-hidden rounded-(--radius) border border-border bg-surface p-1.5 shadow-lg shadow-black/5">
          {(item.children ?? []).map((child) => {
            const childActive = !child.external && isActive(pathname, child.href);

            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  {...(child.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrentPage(pathname, child.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
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
      </div>
    </li>
  );
}
