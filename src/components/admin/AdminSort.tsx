"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type { FilterOption, SortDirection, SortState } from "@/lib/admin/sort";
import { cn } from "@/lib/utils/cn";

export type SortOption = { label: string; key: string; dir: SortDirection };

type Params = Record<string, string | undefined>;

function hrefFor(path: string, params: Params, set: Params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...set })) if (v) query.set(k, v);
  return query.size ? `${path}?${query}` : path;
}

/**
 * "Sort" beside the search box — note 10 §33.1.
 *
 * The column headings already sort, but only somebody who thinks to click a
 * heading finds that. This names the orderings people actually reach for
 * ("Newest first", "Name A to Z", "Highest total") in one visible place next
 * to search, and says which one the list is in now.
 *
 * Its choices are links to the same `?sort=&dir=` URLs the headings use, so
 * the two always agree. `unsorted` is the choice with no sort in the URL: the
 * page's own order, or "Best match" while a search is active.
 */
export function AdminSort({
  path,
  state,
  options,
  unsorted,
  params = {},
}: {
  path: string;
  /** The order the list is in; undefined when it is in the `unsorted` order. */
  state: SortState | undefined;
  options: SortOption[];
  unsorted?: { label: string };
  /** Other query parameters to carry along (the search, the filters). */
  params?: Params;
}) {
  const chosen = state ? options.find((o) => o.key === state.key && o.dir === state.dir) : undefined;
  return (
    <Picker
      name="Sort"
      menuLabel="Sort the list"
      // A heading can put the list in an order this menu does not list.
      current={chosen?.label ?? (state ? "Custom" : (unsorted?.label ?? "Choose"))}
      items={[
        ...(unsorted ? [{ label: unsorted.label, href: hrefFor(path, params), selected: !state }] : []),
        ...options.map((o) => ({
          label: o.label,
          href: hrefFor(path, params, { sort: o.key, dir: o.dir }),
          selected: o === chosen,
        })),
      ]}
    />
  );
}

/**
 * "Status: Paid" — show only the rows with one value of a column (note 10
 * §33.1).
 *
 * One of these per column worth narrowing by. Its choices are the values that
 * column actually holds in the list, each with how many rows have it, so
 * nothing offered leads to an empty page. "Any" clears it. Like the sort, the
 * choice is a URL (`?is_<column>=<value>`), and it is filled in so the button
 * itself says the list is narrowed.
 */
export function AdminFilter({
  path,
  name,
  param,
  current,
  options,
  params = {},
}: {
  path: string;
  /** The column's heading, "Status". */
  name: string;
  /** The query parameter, from `filterParam(key)`. */
  param: string;
  current: string | undefined;
  options: FilterOption[];
  /** Other query parameters to carry along; this filter's own is replaced. */
  params?: Params;
}) {
  const rest = { ...params, [param]: undefined };
  const chosen = options.find((o) => o.value === current);
  // Nothing to choose between.
  if (options.length < 2 && !current) return null;

  return (
    <Picker
      name={name}
      menuLabel={`Show only one ${name.toLowerCase()}`}
      current={chosen?.label ?? (current ? current : "Any")}
      active={Boolean(current)}
      items={[
        { label: "Any", href: hrefFor(path, rest), selected: !current },
        ...options.map((o) => ({
          label: o.label,
          count: o.count,
          href: hrefFor(path, rest, { [param]: o.value }),
          selected: o.value === current,
        })),
      ]}
    />
  );
}

/**
 * The button and menu both controls share. Same outside-click / Escape /
 * focus-restore contract and `.dropdown-panel` motion as `UserMenu` (note 10
 * §37.1).
 */
function Picker({
  name,
  menuLabel,
  current,
  items,
  active = false,
}: {
  name: string;
  menuLabel: string;
  current: string;
  items: Array<{ label: string; href: string; selected: boolean; count?: number }>;
  /** Filled in, to show the list is narrowed. */
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Opens from the button's right edge unless that would run off the left of
  // the screen (a button at the left of a phone). Right by default: the panel
  // is laid out even while closed, and one hanging off the right edge made
  // the whole page scroll sideways on a phone; off the left edge it does not.
  const [fromRight, setFromRight] = useState(true);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        onClick={() => {
          const right = triggerRef.current?.getBoundingClientRect().right ?? window.innerWidth;
          setFromRight(right - 256 >= 8);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={cn(
          "flex h-10 max-w-[min(18rem,calc(100vw-2rem))] items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap shadow-card transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          active ? "border-accent bg-accent/10" : "bg-surface",
          open ? "border-accent" : !active && "border-border hover:border-foreground/40",
        )}
      >
        <span className="text-muted-foreground">{name}</span>
        <span className={cn("truncate font-medium", active && "text-accent")}>{current}</span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn("h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label={menuLabel}
        aria-hidden={!open}
        data-open={open}
        className={cn(
          "dropdown-panel absolute z-30 w-64 max-w-[calc(100vw-2rem)] pt-2",
          fromRight ? "right-0 origin-top-right" : "left-0 origin-top-left",
        )}
      >
        <div className="max-h-80 overflow-y-auto overscroll-contain rounded-(--radius-lg) border border-border bg-surface p-1.5 shadow-lift">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              role="menuitemradio"
              aria-checked={item.selected}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm transition-colors hover:bg-surface-muted",
                item.selected ? "font-medium text-accent" : "text-foreground/90 hover:text-foreground",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.count !== undefined ? (
                <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{item.count}</span>
              ) : null}
              {item.selected ? (
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 shrink-0">
                  <path d="m2.5 6.5 2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
