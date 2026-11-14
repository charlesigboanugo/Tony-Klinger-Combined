"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

/**
 * A session's replay, played here rather than on the host's site (owner,
 * 2026-11-14). A paid Livid video is restricted to this site's domains, so it
 * plays only when embedded here; opening it on livid.com would not work, and
 * would hand the address to anyone. The player loads only when opened, and is
 * removed again on close so the video stops.
 */
export function ReplayPlayer({ embed, title }: { embed: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onClose = () => setOpen(false);
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5">
          <path d="M3 2v8l7-4z" fill="currentColor" />
        </svg>
        Watch recording
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        // A click on the backdrop (outside the panel) closes.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-4xl bg-transparent p-0 backdrop:bg-black/70"
      >
        <div className="overflow-hidden rounded-(--radius-lg) bg-surface text-foreground shadow-lift">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
            <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold">
              {title}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => dialog.current?.close()}>
              Close
            </Button>
          </div>
          <div className="relative aspect-video w-full bg-black">
            {open ? (
              <iframe
                src={embed}
                title={title}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
