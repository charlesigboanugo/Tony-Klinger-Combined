"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A listing section that opens and closes — note 10 §33.3.
 *
 * The band that starts a section (its name and its count, in the reversed
 * colour) is a button: pressing it folds the section's rows away or brings
 * them back, so a long list can be read a section at a time. Sections are
 * independent, any number can be open, and they all start open, so nothing is
 * hidden until somebody chooses to hide it.
 *
 * The rows stay in the page when folded (hidden, not removed), so "find in
 * page" still knows about them and unfolding costs nothing.
 */
/*
  THE ADMIN INDIGO (owner, 2026-10-14). The band was the page's text colour
  reversed, which on the dark theme made it a bright white bar: distinct, but
  shouting over the rows it heads. Indigo is Admin's own identity colour (the
  strip along the top of every admin page), a different hue from the rows in
  both themes without being the brightest thing on the screen. The same value
  in both themes, lettered in the light block foreground.
*/
const fill = "bg-block-indigo text-block-foreground";

function Band({
  label,
  count,
  open,
  controls,
  onToggle,
}: {
  label: ReactNode;
  count?: number;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={cn("h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")}
      >
        <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[0.9375rem] font-semibold">{label}</span>
      {count !== undefined ? (
        <span className="rounded-full bg-block-foreground/15 px-2 py-0.5 text-xs font-medium tabular-nums">{count}</span>
      ) : null}
      <span className="ml-auto text-xs font-normal opacity-70">{open ? "Hide" : "Show"}</span>
    </button>
  );
}

/**
 * Inside an `AdminTable` marked `sectioned`: the section's band and its rows,
 * as one `<tbody>`. `children` are the section's `<tr>` rows.
 */
export function AdminGroupSection({
  label,
  count,
  colSpan,
  children,
  defaultOpen = true,
}: {
  label: ReactNode;
  count?: number;
  colSpan: number;
  children: ReactNode;
  /** Start folded, e.g. finished batches under Past, which pile up over years. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    // A strip of the page's own ground above every section but the first, so
    // the table reads as separate sections rather than one run of rows.
    <tbody
      id={id}
      className={cn(
        "divide-y divide-border [&:not(:first-of-type)]:border-t-[0.875rem] [&:not(:first-of-type)]:border-background",
        !open && "[&>tr:not(:first-child)]:hidden",
      )}
    >
      <tr className={fill}>
        <th scope="colgroup" colSpan={colSpan} className="p-0 text-left font-normal">
          <Band label={label} count={count} open={open} controls={id} onToggle={() => setOpen((v) => !v)} />
        </th>
      </tr>
      {children}
    </tbody>
  );
}

/** The same above a list that is not a table: the band, then `children`. */
export function AdminGroupBlock({ label, count, children }: { label: ReactNode; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();

  return (
    <div>
      <h3 className={cn("overflow-hidden rounded-(--radius) font-sans", fill, open && "mb-3")}>
        <Band label={label} count={count} open={open} controls={id} onToggle={() => setOpen((v) => !v)} />
      </h3>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
