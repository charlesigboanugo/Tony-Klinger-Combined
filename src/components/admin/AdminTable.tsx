import Link from "next/link";
import type { ReactNode } from "react";

import type { SortDirection, SortState } from "@/lib/admin/sort";
import { cn } from "@/lib/utils/cn";

/** A column heading: plain text, or one the list can be sorted by. */
export type AdminHeader =
  | string
  | {
      label: string;
      /** The `?sort=` value, one of the keys the page gave `readSort`. */
      key: string;
      /** Direction of the first click. Dates and amounts start newest/largest. */
      first?: SortDirection;
    };

/**
 * Admin table — note 10 §32, §33.
 *
 * Denser than public pages, but built from the same tokens. Scrolls
 * horizontally on small screens rather than crushing columns into
 * illegibility.
 *
 * WIDER THAN THE SCREEN, IT SCROLLS (owner, 2026-10-13). The table keeps a
 * width its columns can be read at (about 8.5rem each) and the frame around
 * it scrolls sideways, on any screen too narrow for that. The page itself
 * never scrolls sideways. The frame can be focused, so the keyboard can
 * scroll it too.
 *
 * SORTABLE HEADINGS (owner, 2026-10-13; note 10 §33.1). A heading given a
 * `key` is a link that sorts by that column; clicking the sorted column again
 * reverses it. They are links, not buttons, because the sort is a URL. The
 * arrow shows the current direction, and a faint one appears on hover so a
 * sortable heading can be told from a plain one. `sort.params` are the other
 * query parameters to carry along (the search, the filter tabs).
 */
export function AdminTable({
  headers,
  children,
  empty,
  sort,
  sectioned = false,
}: {
  headers: AdminHeader[];
  children: ReactNode;
  empty?: string;
  /** The children are `<tbody>` sections (`AdminGroupSection`), not rows. */
  sectioned?: boolean;
  sort?: {
    path: string;
    state: SortState | undefined;
    params?: Record<string, string | undefined>;
  };
}) {
  const headingType = "text-[0.6875rem] font-semibold tracking-widest uppercase";

  return (
    <div
      role="region"
      aria-label="Table, scrolls sideways if it is wider than the screen"
      tabIndex={0}
      className="max-w-full overflow-x-auto overscroll-x-contain rounded-(--radius-lg) border border-border bg-surface shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full text-sm [overflow-wrap:normal]" style={{ minWidth: `${Math.max(36, headers.length * 8.5)}rem` }}>
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            {headers.map((h, i) => {
              if (typeof h === "string" || !sort) {
                const label = typeof h === "string" ? h : h.label;
                return (
                  <th key={label || i} scope="col" className={cn("px-4 py-3 text-left text-muted-foreground", headingType)}>
                    {label}
                  </th>
                );
              }

              const active = sort.state?.key === h.key ? sort.state.dir : undefined;
              const next: SortDirection = active ? (active === "asc" ? "desc" : "asc") : (h.first ?? "asc");
              const query = new URLSearchParams();
              for (const [k, v] of Object.entries(sort.params ?? {})) if (v) query.set(k, v);
              query.set("sort", h.key);
              query.set("dir", next);

              return (
                <th
                  key={h.key}
                  scope="col"
                  aria-sort={active ? (active === "asc" ? "ascending" : "descending") : undefined}
                  className="px-4 py-3 text-left"
                >
                  <Link
                    href={`${sort.path}?${query}`}
                    scroll={false}
                    title={`Sort by ${h.label.toLowerCase()}, ${next === "asc" ? "ascending" : "descending"}`}
                    className={cn(
                      "group -mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 whitespace-nowrap transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      headingType,
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {h.label}
                    <svg
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      className={cn(
                        "h-3 w-3 shrink-0 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
                        active
                          ? "text-accent"
                          : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60",
                        (active ?? next) === "desc" && "rotate-180",
                      )}
                    >
                      <path d="M6 9.5v-7M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        {sectioned ? children : <tbody className="divide-y divide-border">{children}</tbody>}
      </table>
      {empty ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : null}
    </div>
  );
}

/**
 * Status pill.
 *
 * Colour is a SECOND signal, never the only one — the word is always present,
 * so the meaning survives for anyone who cannot distinguish the hues (note 10
 * §21). Unknown statuses fall back to the neutral treatment rather than
 * guessing at a colour.
 */
const TONES: Record<string, string> = {
  paid: "border-success/40 bg-success/10 text-success",
  active: "border-success/40 bg-success/10 text-success",
  published: "border-success/40 bg-success/10 text-success",
  confirmed: "border-success/40 bg-success/10 text-success",
  sent: "border-success/40 bg-success/10 text-success",
  succeeded: "border-success/40 bg-success/10 text-success",
  // Still to come and going ahead: a session or workshop on the calendar, a
  // one-to-one time open to book. Green like the other live states, where they
  // were the neutral grey of an unknown value (owner, 2026-10-14).
  scheduled: "border-success/40 bg-success/10 text-success",
  open: "border-success/40 bg-success/10 text-success",
  pending: "border-warning/40 bg-warning/10 text-warning",
  processing: "border-warning/40 bg-warning/10 text-warning",
  paused: "border-warning/40 bg-warning/10 text-warning",
  past_due: "border-warning/40 bg-warning/10 text-warning",
  /*
    Five states of a dated record, five clearly different looks (owner,
    2026-10-14: "no two colours so close as to mix"): Draft amber and dashed,
    Scheduled green, Running solid indigo, Completed grey, Cancelled red. No
    two share a hue; the teal accent is not used, being too near the green.
  */
  // Not yet live: amber and dashed, so it reads as unfinished at a glance.
  draft: "border-dashed border-warning bg-warning/10 text-warning",
  // Under way now (a run, session or event that has started and not ended).
  // Under way now: solid indigo (Admin's own colour), unlike any other state.
  running: "border-block-indigo bg-block-indigo text-block-foreground",
  // Over and done: the quiet solid grey of a record (owner, 2026-10-14).
  // A plain grey outline with no fill: on the dark theme a grey fill came out
  // blue-grey, too near Running's indigo.
  completed: "border-foreground/30 bg-transparent text-muted-foreground",
  failed: "border-error/40 bg-error/10 text-error",
  cancelled: "border-error/40 bg-error/10 text-error",
  expired: "border-error/40 bg-error/10 text-error",
  refunded: "border-error/40 bg-error/10 text-error",
  no_show: "border-error/40 bg-error/10 text-error",
  revoked: "border-error/40 bg-error/10 text-error",
  archived: "border-border bg-surface-muted text-muted-foreground",
  // Over and done (a past run, session or event): quiet, never the green of
  // something live (owner, 2026-10-14).
  finished: "border-border bg-surface-muted text-muted-foreground",
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize",
        TONES[value] ?? "border-border bg-surface-muted text-muted-foreground",
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
