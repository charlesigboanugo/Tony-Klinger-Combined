"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

export type AudioTrack = { src: string; title: string };

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * A player for a work's hosted recordings — note 08 §60.1, note 10 §42.
 *
 * Built on one native <audio> element: the browser does the streaming (range
 * requests, so a 40-minute interview starts at once and seeks without
 * downloading the lot), and this draws the controls in the site's own
 * vocabulary instead of each browser's grey strip. A recording in parts gets
 * a row of part buttons; the next part starts when one ends.
 *
 * Accessible as a real control: the play button is a <button> with a
 * changing label, the scrubber is a native range input announcing
 * "12:04 of 40:31", and nothing plays until asked. `preload="metadata"`
 * fetches only enough to know the length.
 *
 * Set for the dark title card it sits in (`secondary`, dark in both themes);
 * the play button is the brand red with white, as every red fill is.
 */
export function AudioPlayer({ tracks, className }: { tracks: AudioTrack[]; className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Set when a part change should carry on playing once the new source loads.
  const autoplay = useRef(false);

  const track = tracks[index];

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    // `preload="metadata"` often finishes before hydration attaches
    // onLoadedMetadata, so the event is missed. Read what is already known.
    // (Deferred a frame: state is not set synchronously inside an effect.)
    const known = requestAnimationFrame(() => {
      if (el.readyState >= 1) setDuration(el.duration);
    });
    if (autoplay.current) {
      autoplay.current = false;
      void el.play();
    }
    return () => cancelAnimationFrame(known);
  }, [index]);

  if (!track) return null;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const choose = (i: number) => {
    if (i === index) return;
    autoplay.current = playing;
    setTime(0);
    setDuration(0);
    setIndex(i);
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-(--radius-lg) border border-secondary-foreground/15 bg-secondary-foreground/6 p-4 backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <audio
        ref={audio}
        src={track.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setPlaying(false);
          if (index < tracks.length - 1) {
            autoplay.current = true;
            setTime(0);
            setIndex(index + 1);
          }
        }}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          className="grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-button text-button-foreground shadow-lift transition-transform duration-(--dur-fast) ease-expo hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 motion-reduce:transition-none"
        >
          {playing ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-current">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-0.5 size-6 fill-current">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-secondary-foreground">{track.title}</p>

          <div className="relative mt-2.5 h-4">
            {/* Drawn track and fill; the transparent range input sits on top
                and is the real, keyboard-operable control. */}
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary-foreground/20">
              <div className="h-full rounded-full bg-secondary-foreground" style={{ width: `${progress}%` }} />
            </div>
            <div
              aria-hidden="true"
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary-foreground shadow"
              style={{ left: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={Math.min(time, duration || 0)}
              disabled={!duration}
              onChange={(e) => {
                const el = audio.current;
                if (el) el.currentTime = Number(e.currentTarget.value);
              }}
              aria-label={`Seek ${track.title}`}
              aria-valuetext={`${clock(time)} of ${clock(duration)}`}
              className="peer absolute inset-0 w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-white"
            />
          </div>

          <p className="mt-1.5 flex justify-between text-xs text-secondary-foreground/65 tabular-nums">
            <span>{clock(time)}</span>
            <span>{duration ? clock(duration) : "–:––"}</span>
          </p>
        </div>
      </div>

      {tracks.length > 1 ? (
        <div role="group" aria-label="Parts" className="mt-4 flex flex-wrap gap-2 border-t border-secondary-foreground/15 pt-4">
          {tracks.map((t, i) => (
            <button
              key={t.src}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={i === index}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-xs font-semibold transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                i === index
                  ? "border-secondary-foreground bg-secondary-foreground text-secondary"
                  : "border-secondary-foreground/30 text-secondary-foreground/80 hover:border-secondary-foreground",
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
