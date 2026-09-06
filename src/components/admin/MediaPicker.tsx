"use client";

import { useMemo, useState } from "react";

import { publicStorageUrl } from "@/lib/storage/public-url";

/**
 * Choose an image from the media library — note 06 §16.
 *
 * The alternative was a text field expecting a UUID, which is unusable against
 * 356 images: an operator would have to find the id in one screen and paste it
 * into another, with no way to see what they were choosing.
 *
 * The imported filenames are meaningless (Facebook export ids, numbered PNGs),
 * so BROWSING BY THUMBNAIL is the only workable way to pick one — searching by
 * name only helps for the handful that were named sensibly. The search box
 * filters on the title, which for imported files also carries the page the
 * image appeared on, so "carter" finds the images used on that film's page.
 */
export type MediaOption = {
  id: string;
  title: string;
  storage_path: string | null;
};

export function MediaPicker({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: MediaOption[];
  defaultValue?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(defaultValue ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const current = options.find((o) => o.id === selected) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? options.filter((o) => o.title.toLowerCase().includes(q))
      : options;
    // Capped: rendering 356 thumbnails at once is a slow page and an
    // unreadable wall. Narrowing the search is the way to reach the rest.
    return pool.slice(0, 60);
  }, [options, query]);

  return (
    <div className="space-y-3">
      {/* The value the form actually submits. Everything else here is a way of
          choosing it. */}
      <input type="hidden" name={name} value={selected ?? ""} />

      <div className="flex items-start gap-3">
        {current?.storage_path ? (
          /* A plain <img> on purpose: this is a staff-only preview of an
             arbitrary library image, and next/image would optimise 356
             distinct sources for thumbnails no customer ever sees. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicStorageUrl(current.storage_path) ?? ""}
            alt=""
            className="h-20 w-20 rounded-(--radius) border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-(--radius) border border-dashed border-border text-xs text-muted-foreground">
            None
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {current ? current.title : "No image selected"}
          </p>
          <div className="mt-2 flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="underline underline-offset-4 hover:text-accent"
            >
              {open ? "Close library" : current ? "Change" : "Choose an image"}
            </button>
            {current ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground underline underline-offset-4 hover:text-error"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {open ? (
        <div className="rounded-(--radius) border border-border p-3">
          <label htmlFor={`${name}-search`} className="sr-only">
            Search the media library
          </label>
          <input
            id={`${name}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by filename or the page it appeared on…"
            className="h-10 w-full rounded-(--radius) border border-input-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />

          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {matches.length === 0
              ? "Nothing matches."
              : `Showing ${matches.length} of ${options.length}. Search to narrow.`}
          </p>

          <ul className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
            {matches.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(option.id);
                    setOpen(false);
                  }}
                  aria-pressed={option.id === selected}
                  title={option.title}
                  className={`block w-full overflow-hidden rounded-(--radius) border transition-colors ${
                    option.id === selected
                      ? "border-accent ring-2 ring-accent"
                      : "border-border hover:border-accent"
                  }`}
                >
                  {option.storage_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicStorageUrl(option.storage_path) ?? ""}
                      alt={option.title}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <span className="flex aspect-square items-center justify-center p-1 text-[10px] text-muted-foreground">
                      {option.title.slice(0, 24)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
