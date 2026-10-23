"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { codeLabel } from "@/lib/admin/labels";
import { publicStorageUrl } from "@/lib/storage/public-url";

/**
 * Choose a Media item from cards — note 06 §16.
 *
 * Each field shows only the kinds it takes (owner, 2026-10-15): a cover sees
 * images, a recording sees videos and audio, newest first. Where a field takes
 * more than one kind, a switch in the dialog narrows to one.
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
 *
 * The library opens in a dialog that takes most of the screen (owner,
 * 2026-10-13): a small box of sixty thumbnails hid most of the library. Every
 * image is reachable, a page at a time, with First, Previous, Next and Last; a page rather
 * than one long wall, so only the thumbnails on show are downloaded.
 */
const PAGE_SIZE = 48;

export type MediaOption = {
  id: string;
  title: string;
  /** Only for an image in a public bucket: the picture to show. */
  storage_path: string | null;
  /** The Media type: image, video, audio, document, link. */
  kind: string;
  /** A file in a private bucket. */
  isPrivate: boolean;
};

const plural = (kind: string) => codeLabel(kind) + (kind === "audio" ? "" : "s");
const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

export function MediaPicker({
  name,
  options,
  kinds = ["image"],
  noun = "image",
  defaultValue,
  disabled = false,
}: {
  name: string;
  /** Already only the kinds this field takes, newest first. */
  options: MediaOption[];
  /** The kinds this field takes, for the switch in the dialog. */
  kinds?: readonly string[];
  /** What is being chosen, in words: "image", "recording". */
  noun?: string;
  /** Shown, but cannot be changed (a finished row). */
  disabled?: boolean;
  defaultValue?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(defaultValue ?? null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const titleId = useId();

  const current = options.find((o) => o.id === selected) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ofKind = kind ? options.filter((o) => o.kind === kind) : options;
    return q ? ofKind.filter((o) => o.title.toLowerCase().includes(q)) : ofKind;
  }, [options, query, kind]);

  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const at = Math.min(page, pages - 1);
  const shown = matches.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE);

  const show = useCallback(() => {
    dialog.current?.showModal();
    // Next frame, so the opening state is painted before it changes.
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    // After the closing transition; at once for reduced motion.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => dialog.current?.close(), reduced ? 0 : 200);
  }, []);

  // Esc closes through the same path, so it animates out too.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      hide();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [hide]);

  const turn = (to: number) => {
    setPage(to);
    grid.current?.scrollTo({ top: 0 });
  };

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
        ) : current ? (
          <div className="flex h-20 w-20 items-center justify-center rounded-(--radius) border border-border bg-surface-muted text-xs font-medium">
            {codeLabel(current.kind)}
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-(--radius) border border-dashed border-border text-xs text-muted-foreground">
            None
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {current ? current.title : `No ${noun} selected`}
          </p>
          {current?.isPrivate ? <p className="text-xs text-muted-foreground">Private</p> : null}
          {disabled ? null : (
          <div className="mt-2 flex gap-3 text-sm">
            <button
              type="button"
              onClick={show}
              aria-haspopup="dialog"
              className="cursor-pointer underline underline-offset-4 hover:text-accent"
            >
              {current ? "Change" : `Choose ${withArticle(noun)}`}
            </button>
            {current ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="cursor-pointer text-muted-foreground underline underline-offset-4 hover:text-error"
              >
                Remove
              </button>
            ) : null}
          </div>
          )}
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        data-open={open}
        // A click on the backdrop (the dialog itself, outside the panel) closes.
        onClick={(event) => {
          if (event.target === event.currentTarget) hide();
        }}
        className="m-auto h-[calc(100dvh-2rem)] max-h-none w-[calc(100%-2rem)] max-w-7xl bg-transparent p-0 text-left backdrop:bg-black/0 backdrop:transition-[background-color] backdrop:duration-(--dur-base) data-[open=true]:backdrop:bg-black/50"
      >
        <div className="flex h-full scale-95 flex-col rounded-(--radius-lg) border border-border bg-surface text-foreground opacity-0 shadow-lift transition-[opacity,transform] duration-200 ease-out in-data-[open=true]:scale-100 in-data-[open=true]:opacity-100 motion-reduce:transition-none">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 sm:px-6">
            <h2 id={titleId} className="font-sans text-lg font-semibold">
              Choose {withArticle(noun)}
            </h2>
            <label htmlFor={`${name}-search`} className="sr-only">
              Search the media library
            </label>
            <input
              id={`${name}-search`}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                turn(0);
              }}
              // Enter here must not submit the form the picker sits in.
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder={kinds.includes("image") ? "Search by filename or the page it appeared on…" : "Search by title…"}
              className="h-10 min-w-0 flex-1 basis-64 rounded-full border border-input-border bg-background px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <Button type="button" variant="outline" size="sm" onClick={hide}>
              Close
            </Button>
            {kinds.length > 1 ? (
              <div role="group" aria-label="Type" className="flex w-full flex-wrap gap-1">
                {[null, ...kinds].map((k) => (
                  <button
                    key={k ?? "all"}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => {
                      setKind(k);
                      turn(0);
                    }}
                    className={`inline-flex h-8 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm transition-colors ${
                      kind === k
                        ? "bg-foreground font-medium text-background"
                        : "border border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    }`}
                  >
                    {k ? plural(k) : "All"}
                    <span className="text-xs opacity-75">
                      {k ? options.filter((o) => o.kind === k).length : options.length}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Only while open, so a form with several pickers does not download
              every library page behind dialogs nobody has opened. */}
          <ul
            ref={grid}
            className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4 sm:px-6 lg:grid-cols-6 xl:grid-cols-8"
          >
            {open
              ? shown.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(option.id);
                        hide();
                      }}
                      aria-pressed={option.id === selected}
                      title={option.title}
                      className={`relative block w-full cursor-pointer overflow-hidden rounded-(--radius) border bg-surface-muted text-left transition-colors ${
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
                        <span className="flex aspect-square items-center justify-center p-2 text-sm font-medium text-muted-foreground">
                          {codeLabel(option.kind)}
                        </span>
                      )}
                      {option.isPrivate ? (
                        <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
                          Private
                        </span>
                      ) : null}
                      <span className="block truncate bg-surface px-2 py-1.5 text-xs text-muted-foreground">
                        {option.title}
                      </span>
                    </button>
                  </li>
                ))
              : null}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 sm:px-6">
            <p className="text-sm text-muted-foreground" role="status">
              {matches.length === 0
                ? options.length === 0
                  ? `Nothing to choose yet. Add ${withArticle(noun)} under Media first.`
                  : "Nothing matches."
                : `${at * PAGE_SIZE + 1} to ${at * PAGE_SIZE + shown.length} of ${matches.length} · page ${at + 1} of ${pages}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={at === 0} onClick={() => turn(0)}>
                First
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={at === 0} onClick={() => turn(at - 1)}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={at >= pages - 1} onClick={() => turn(at + 1)}>
                Next
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={at >= pages - 1} onClick={() => turn(pages - 1)}>
                Last
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
