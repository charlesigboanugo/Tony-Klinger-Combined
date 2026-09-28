"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A cover that becomes the player when pressed.
 *
 * A wall of eleven videos as eleven live iframes is eleven third-party players
 * booting on page load, for clips most visitors will never start. The cover is
 * server-rendered (`children`); only the press swaps in the iframe, asking it
 * to play at once, since the press was the request to play.
 *
 * Public video only. The embed URL passes through client props here, so it
 * lands in the page's serialised data — right for marketing video, never for
 * gated lesson video (that is `LessonVideo`, which stays on the server).
 */
export function VideoFacade({
  src,
  title,
  children,
  className,
}: {
  src: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    const url = new URL(src);
    url.searchParams.set("autoplay", "1");
    return (
      <div className={cn("relative bg-black", className)}>
        <iframe
          src={url.toString()}
          title={`${title} — video`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin"
          className="absolute inset-0 size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        // Tells an enclosing Carousel to stop advancing (see Carousel).
        e.currentTarget.dispatchEvent(new CustomEvent("media:play", { bubbles: true }));
        setPlaying(true);
      }}
      aria-label={`Play ${title}`}
      className={cn("group relative block w-full cursor-pointer text-left", className)}
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 grid size-16 -translate-1/2 place-items-center rounded-full bg-white/90 text-black shadow-lift transition-[transform,background-color,color] duration-300 ease-(--ease-out-expo) group-hover:scale-110 group-hover:bg-button group-hover:text-button-foreground group-focus-visible:bg-button group-focus-visible:text-button-foreground motion-reduce:transition-none"
      >
        <svg viewBox="0 0 24 24" className="ml-1 size-6" fill="currentColor">
          <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.98-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
        </svg>
      </span>
    </button>
  );
}
