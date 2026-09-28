import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Admin page building blocks — note 04 §32.2, note 10 §32.
 *
 * Admin pages are an operational workspace, so they share the `.workspace`
 * app scale with Account and the Academy: body-face headings at app size,
 * starting level with the first sidebar item. `PageHeader` pushed every
 * title down to the public hero height in the display serif, which put a
 * poster over a table.
 */

export function AdminPageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** A small figure beside the title, e.g. a row count. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-balance">{title}</h1>
          {meta ? <span className="text-sm text-muted-foreground tabular-nums">{meta}</span> : null}
        </div>
        {description ? (
          <div className="measure text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("mt-14 first:mt-0", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id} className="text-lg">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Filter tabs as links, so a filtered view is a URL: shareable, reloadable,
 * working before hydration. Counts say what is behind each tab before it is
 * clicked. Other query parameters named in `keep` survive a tab change.
 */
export function FilterTabs({
  path,
  param,
  current,
  options,
  keep = {},
  label,
}: {
  path: string;
  param: string;
  current: string | undefined;
  options: Array<{ value: string | undefined; label: string; count?: number }>;
  keep?: Record<string, string | undefined>;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 mb-5 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-1 rounded-full border border-border bg-surface p-1 shadow-card">
        {options.map((option) => {
          const query = new URLSearchParams();
          for (const [k, v] of Object.entries(keep)) if (v) query.set(k, v);
          if (option.value) query.set(param, option.value);
          const href = query.size ? `${path}?${query}` : path;
          const selected = option.value === current;
          return (
            <li key={option.label}>
              <Link
                href={href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected
                    ? "bg-foreground font-medium text-background"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {option.label}
                {option.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      selected ? "bg-background/20" : "bg-surface-muted",
                    )}
                  >
                    {option.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A GET search box — the result is a URL, like the filter tabs. */
export function AdminSearch({
  path,
  query,
  placeholder,
  label,
  keep = {},
}: {
  path: string;
  query: string | undefined;
  placeholder: string;
  label: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <form method="get" action={path} role="search" className="flex flex-wrap items-center gap-2">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor={`${path}-q`} className="sr-only">
        {label}
      </label>
      <div className="relative">
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
          id={`${path}-q`}
          name="q"
          type="search"
          defaultValue={query ?? ""}
          placeholder={placeholder}
          className="h-10 w-72 max-w-full rounded-full border border-border bg-surface pr-4 pl-9 text-sm shadow-card placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40"
        />
      </div>
      <button
        type="submit"
        className="h-10 rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
      >
        Search
      </button>
      {query ? (
        <Link
          href={path}
          className="flex h-10 items-center px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

/** A key/value summary card — order, system status. */
export function DetailGrid({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-5 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:grid-cols-2 sm:p-6 xl:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A person, as a table cell: name over email, linked to their admin page. */
export function PersonCell({
  id,
  name,
  email,
  fallback = "—",
}: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  fallback?: string;
}) {
  const primary = name ?? email ?? fallback;
  const secondary = name && email ? email : null;
  const body = (
    <>
      <span className="block truncate font-medium">{primary}</span>
      {secondary ? <span className="block truncate text-xs text-muted-foreground">{secondary}</span> : null}
    </>
  );
  return id ? (
    <Link href={`/admin/users/${id}`} className="block max-w-64 hover:text-accent">
      {body}
    </Link>
  ) : (
    <span className="block max-w-64">{body}</span>
  );
}

const UK = "Europe/London";

export function ukDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: UK });
}

export function ukDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: UK,
  });
}

export function humanise(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
