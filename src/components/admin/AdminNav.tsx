"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { isActive, isCurrentPage, type NavGroup, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Admin workspace navigation — note 04 §14, §15, §24, §32.
 *
 * Receives pre-filtered groups: the server decides what this operator may see.
 * Hiding an item is a usability decision; the route still enforces the
 * permission itself (note 06 §24).
 *
 * TWO LEVELS THAT LOOK LIKE TWO LEVELS (owner, 2026-09-27). Group headings used
 * to be small grey capitals set exactly like the links beneath them, so
 * "Customers" read as one more item rather than the start of a section. Now:
 *
 *   level 1   a group: a button with an icon tile, its name in the foreground
 *             weight, a count and a chevron — it opens and closes
 *   level 2   its pages: indented under the group on a guide line, no icon,
 *             lighter; the current one teal with a bar on the line
 *
 * One group is open at a time: opening another closes it. The group holding
 * the current page opens on arrival. "Find a page" (or "/") filters every page by name across all groups,
 * and Enter goes to the first match — ~35 destinations should never need
 * hunting for.
 *
 * Below lg the same content sits behind ONE button naming the current page,
 * as Account and the Academy do (note 04 §27: no link strips).
 *
 * Exactly ONE item lights up, by longest matching href: "/admin" is a prefix
 * of every other item purely as a side effect of routing.
 */

const GROUP_ICONS: Record<string, ReactNode> = {
  Overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  People: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M15 14.5c2.8 0 5 1.3 5 4.5" />
    </>
  ),
  Commerce: (
    <>
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  Content: (
    <>
      <path d="M7 3.5h7l4.5 4.5v12.5H7z" />
      <path d="M14 3.5V8h4.5M10 12.5h6M10 16h6" />
    </>
  ),
  Learning: (
    <>
      <path d="m3 9 9-4.5L21 9l-9 4.5z" />
      <path d="M7 11v4.5c1.5 1.3 3 2 5 2s3.5-.7 5-2V11M21 9v5" />
    </>
  ),
  Experiences: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  Communications: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  System: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
};

function GroupIcon({ label, className }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GROUP_ICONS[label] ?? GROUP_ICONS.Overview}
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn(
        "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
        open && "rotate-90",
      )}
    >
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Located = { item: NavItem; group: string };

function activeFor(pathname: string, groups: NavGroup[]): Located | undefined {
  return groups
    .flatMap((group) => group.items.map((item) => ({ item, group: group.label })))
    .filter(({ item }) => isActive(pathname, item.href))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0];
}

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const active = activeFor(pathname, groups);

  return (
    <>
      <div className="lg:hidden">
        <SectionSwitcher groups={groups} pathname={pathname} active={active} />
      </div>
      <nav aria-label="Admin" className="hidden lg:block">
        <NavBody groups={groups} pathname={pathname} active={active} shortcut />
      </nav>
    </>
  );
}

/** The finder and the tree — shared by the sidebar and the phone panel. */
function NavBody({
  groups,
  pathname,
  active,
  shortcut = false,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  active: Located | undefined;
  shortcut?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // "/" jumps to the finder from anywhere that is not already a text field.
  useEffect(() => {
    if (!shortcut) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  const term = query.trim().toLowerCase();
  const matches: Located[] = term
    ? groups.flatMap((group) =>
        group.items
          .filter((item) => `${item.label} ${group.label}`.toLowerCase().includes(term))
          .map((item) => ({ item, group: group.label })),
      )
    : [];

  function go(href: string) {
    setQuery("");
    onNavigate?.();
    router.push(href);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Find a page
        </label>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              go(matches[0].item.href);
            }
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Find a page"
          autoComplete="off"
          className="h-10 w-full rounded-(--radius) border border-border bg-background pr-9 pl-9 text-sm placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40"
        />
        {shortcut && !query ? (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-border bg-surface-muted px-1.5 font-mono text-[0.6875rem] leading-5 text-muted-foreground"
          >
            /
          </kbd>
        ) : null}
      </div>

      {term ? (
        matches.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No page called “{query.trim()}”.</p>
        ) : (
          <ul aria-label="Matching pages" className="space-y-0.5">
            {matches.map(({ item, group }, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    setQuery("");
                    onNavigate?.();
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-(--radius) px-3 py-2 text-sm transition-colors hover:bg-surface-muted",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    i === 0 && "bg-surface-muted",
                  )}
                >
                  <GroupIcon label={group} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{group}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <Tree groups={groups} pathname={pathname} active={active} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function Tree({
  groups,
  pathname,
  active,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  active: Located | undefined;
  onNavigate?: () => void;
}) {
  const activeGroup = active?.group;
  // An accordion: ONE group open at a time (owner, 2026-09-27). Opening a
  // group closes whichever was open; clicking the open one closes it.
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroup);

  // Arriving on a page in another group opens that group (and so closes the
  // rest) — adjusting state during render, as AccountNav closes its panel.
  const [seenGroup, setSeenGroup] = useState(activeGroup);
  if (seenGroup !== activeGroup) {
    setSeenGroup(activeGroup);
    setOpenGroup(activeGroup);
  }

  function toggle(label: string) {
    setOpenGroup((current) => (current === label ? undefined : label));
  }

  return (
    <ul className="space-y-1">
      {groups.map((group) => {
        // Overview holds only the dashboard: a heading over one link is
        // chrome, so it is the dashboard link itself, at group level.
        if (group.label === "Overview") {
          return group.items.map((item) => {
            const current = active?.item.href === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-(--radius) px-2 py-1.5 text-sm font-semibold transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    current ? "bg-accent/10 text-accent" : "text-foreground hover:bg-surface-muted",
                  )}
                >
                  <IconTile label="Overview" active={current} />
                  {item.label}
                </Link>
              </li>
            );
          });
        }

        const isOpen = openGroup === group.label;
        const holdsActive = activeGroup === group.label;
        const panelId = `admin-nav-${group.label.toLowerCase().replace(/\W+/g, "-")}`;

        return (
          <li key={group.label}>
            <button
              type="button"
              onClick={() => toggle(group.label)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={cn(
                "flex w-full items-center gap-3 rounded-(--radius) px-2 py-1.5 text-left text-sm font-semibold transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "text-foreground hover:bg-surface-muted",
              )}
            >
              <IconTile label={group.label} active={holdsActive} />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              <span className="text-xs font-normal text-muted-foreground tabular-nums">{group.items.length}</span>
              <Chevron open={isOpen} />
            </button>

            <div
              id={panelId}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden" inert={!isOpen}>
                <ul className="mt-1 mb-2 ml-5.5 space-y-0.5 border-l border-border pl-3">
                  {group.items.map((item) => {
                    const current = active?.item.href === item.href;
                    return (
                      <li key={item.href} className="relative">
                        {current ? (
                          <span
                            aria-hidden="true"
                            className="absolute top-1.5 bottom-1.5 -left-[calc(0.75rem+1.5px)] w-0.5 rounded-full bg-accent"
                          />
                        ) : null}
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                          className={cn(
                            // px-3.5: with the guide line at the tile's centre
                            // (ml-5.5) and pl-3, the page name starts exactly
                            // where the group name's text does — a child is
                            // never indented less than its heading (owner).
                            "block rounded-(--radius) px-3.5 py-1.5 text-sm transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            current
                              ? "bg-accent/10 font-medium text-accent"
                              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IconTile({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors",
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border bg-surface text-muted-foreground",
      )}
    >
      <GroupIcon label={label} />
    </span>
  );
}

/**
 * Below lg: one button naming where you are; the finder and tree in a panel.
 * Same outside-click / Escape / focus-restore contract and `.dropdown-panel`
 * motion as AccountNav's switcher (note 10 §37.1).
 */
function SectionSwitcher({
  groups,
  pathname,
  active,
}: {
  groups: NavGroup[];
  pathname: string;
  active: Located | undefined;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-block-indigo text-block-foreground"
        >
          <GroupIcon label={active?.group ?? "Overview"} className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Admin{active && active.group !== "Overview" ? ` · ${active.group}` : ""}
          </span>
          <span className="block truncate text-sm font-medium">{active?.item.label ?? "Menu"}</span>
        </span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
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
          aria-label="Admin"
          className="max-h-[70svh] overflow-y-auto overscroll-contain rounded-(--radius-lg) border border-border bg-surface p-3 shadow-lift"
        >
          <NavBody groups={groups} pathname={pathname} active={active} onNavigate={() => setOpen(false)} />
        </nav>
      </div>
    </div>
  );
}
