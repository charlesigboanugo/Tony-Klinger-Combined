"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
import { ukTodayStartLocal } from "@/lib/utils/uk-time";

/**
 * Admin date and time picker (owner, 2026-11-12: "dd/mm/yyyy, --:-- where I
 * have to type… there should be better").
 *
 * A box that reads the choice in words ("Thu 19 Nov 2026, 16:00") and opens a
 * calendar with the time below it, so a date is chosen, not typed. Nothing
 * before `min` can be chosen: those days are greyed out, and on the earliest
 * day so are the earlier times.
 *
 * The form still receives what the browser's own picker sent — a hidden input
 * holding "YYYY-MM-DDTHH:mm" in UK time — so saving is unchanged
 * (`ukLocalToIso` on the server, which also re-checks the earliest date).
 *
 * Same outside-click / Escape / focus-restore contract and `.dropdown-panel`
 * motion as the admin Sort menu (note 10 §37.1).
 *
 * ALWAYS FULLY IN VIEW AND ON TOP (owner, 2026-11-12). The calendar is drawn on
 * the page's top layer (a portal to <body>, fixed to the window), so no card,
 * section or scrolling box around the field can clip or cover it. It sits under
 * the field, or above it when there is more room there, follows the field as
 * the page scrolls, and scrolls within itself on a window too short for it.
 */
const GAP = 8;
const EDGE = 8;
const noSubscribe = () => () => {};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
// A day chosen before any time is: the start of a working day.
const DEFAULT_TIME = "09:00";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** "2026-11-19T16:00" → "Thu 19 Nov 2026, 16:00". Wall-clock text, no zone sums. */
function describe(value: string): string {
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
  return `${weekday} ${d} ${MONTHS[m - 1].slice(0, 3)} ${y}, ${time}`;
}

export function DateTimePicker({
  id,
  name,
  defaultValue = "",
  min,
  required,
  disabled,
  describedBy,
  onChange,
}: {
  id: string;
  name: string;
  /** "YYYY-MM-DDTHH:mm", UK time, or "" for none. */
  defaultValue?: string;
  /** The earliest choice, same shape. */
  min?: string;
  required?: boolean;
  disabled?: boolean;
  describedBy?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  // Days, not minutes: the same on the server and in the browser at hydration.
  const [today] = useState(() => ukTodayStartLocal().slice(0, 10));
  const start = (value || min || `${today}T00:00`).slice(0, 7).split("-").map(Number);
  const [view, setView] = useState({ year: start[0], month: start[1] - 1 });

  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // <body> exists only in the browser: the portal is made there, never while
  // rendering on the server (false there and at hydration, true after).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number; maxHeight: number; above: boolean }>({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 600,
    above: false,
  });

  // Where the calendar goes, from the field's place in the window. Kept up to
  // date while open, so it moves with the field when anything scrolls.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const field = triggerRef.current?.getBoundingClientRect();
      const card = cardRef.current;
      if (!field || !card) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Field-wide on phones; a calendar's width from `sm`.
      const width = Math.min(vw < 640 ? field.width : 320, vw - EDGE * 2);
      const left = Math.min(Math.max(field.left, EDGE), vw - width - EDGE);
      const maxHeight = vh - EDGE * 2;
      const height = Math.min(card.scrollHeight, maxHeight);
      const below = vh - field.bottom - GAP - EDGE;
      const over = field.top - GAP - EDGE;
      const above = below < height && over > below;
      // Never past the window's edge, even when neither side has room.
      const top = above
        ? Math.max(EDGE, field.top - GAP - height)
        : Math.min(field.bottom + GAP, vh - EDGE - height);
      setPlace({ top, left, width, maxHeight, above });
    }
    measure();
    window.addEventListener("resize", measure);
    // Capture: a scrolling box inside the page moves the field as well.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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

  const minDay = min?.slice(0, 10) ?? "";
  const chosenDay = value.slice(0, 10);
  const [hour, minute] = (value.slice(11, 16) || DEFAULT_TIME).split(":");
  const minutes = STEP_MINUTES.includes(minute) ? STEP_MINUTES : [...STEP_MINUTES, minute].sort();

  function commit(next: string) {
    // Never earlier than allowed: a day picked on the earliest date takes the
    // earliest time if the one it carried is before it.
    const clamped = min && next < min ? min : next;
    setValue(clamped);
    onChange?.(clamped);
  }

  function pickDay(key: string) {
    commit(`${key}T${hour}:${minute}`);
  }

  function pickTime(nextHour: string, nextMinute: string) {
    commit(`${chosenDay || (minDay > today ? minDay : today)}T${nextHour}:${nextMinute}`);
  }

  // The month grid, Monday first, padded with blanks.
  const first = new Date(Date.UTC(view.year, view.month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  // No going back to a month that is wholly before the earliest day.
  const canGoBack = !minDay || `${view.year}-${pad(view.month + 1)}` > minDay.slice(0, 7);

  function move(months: number) {
    setView((v) => {
      const m = v.month + months;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  /** Arrow keys walk the days; the grid is re-rendered for another month as needed. */
  function onGridKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const buttons = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-day]:not(:disabled)") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[at + step];
    if (next) next.focus();
    else if (step > 0) move(1);
    else if (canGoBack) move(-1);
  }

  const timeOff = (h: string, m: string) => Boolean(min && chosenDay === minDay && `${chosenDay}T${h}:${m}` < min);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open && value) setView({ year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) - 1 });
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-describedby={describedBy}
        className={cn(
          "flex h-11 w-full items-center gap-3 rounded-(--radius) border bg-background px-3 text-left text-base transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60",
          open ? "border-accent" : "border-input-border hover:border-foreground/40",
        )}
      >
        <Icon name="calendar" className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
          {value ? describe(value) : "Choose a date and time"}
        </span>
      </button>

      {mounted
        ? createPortal(
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-label="Choose a date and time"
        aria-hidden={!open}
        data-open={open}
        style={{ top: place.top, left: place.left, width: place.width }}
        className={cn("dropdown-panel fixed z-60", place.above ? "origin-bottom-left" : "origin-top-left")}
      >
        <div
          ref={cardRef}
          style={{ maxHeight: place.maxHeight }}
          className="overflow-y-auto overscroll-contain rounded-(--radius-lg) border border-border bg-surface p-3 shadow-lift"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
                <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="text-sm font-semibold" aria-live="polite">
              {MONTHS[view.month]} {view.year}
            </p>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next month"
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
                <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d.slice(0, 2)}
              </span>
            ))}
          </div>
          <div ref={gridRef} onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const key = dayKey(view.year, view.month, day);
              const off = Boolean(minDay && key < minDay);
              const selected = key === chosenDay;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  data-day={key}
                  disabled={off}
                  onClick={() => pickDay(key)}
                  aria-pressed={selected}
                  aria-label={describe(`${key}T00:00`).split(",")[0]}
                  className={cn(
                    "grid h-9 place-items-center rounded-full text-sm tabular-nums transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                    selected
                      ? "bg-accent font-semibold text-accent-foreground"
                      : off
                        ? "text-muted-foreground/40 line-through decoration-muted-foreground/30"
                        : "hover:bg-surface-muted",
                    isToday && !selected && "font-semibold text-accent ring-1 ring-accent/40 ring-inset",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <Icon name="clock" className="size-4 shrink-0 text-muted-foreground" />
            <label className="sr-only" htmlFor={`${id}-hour`}>Hour</label>
            <select
              id={`${id}-hour`}
              value={hour}
              onChange={(e) => pickTime(e.target.value, minute)}
              className="h-9 w-21 rounded-(--radius) border border-input-border bg-background pr-9 pl-3 text-sm tabular-nums"
            >
              {HOURS.map((h) => (
                <option key={h} value={h} disabled={timeOff(h, "55")}>
                  {h}
                </option>
              ))}
            </select>
            <span aria-hidden="true">:</span>
            <label className="sr-only" htmlFor={`${id}-minute`}>Minutes</label>
            <select
              id={`${id}-minute`}
              value={minute}
              onChange={(e) => pickTime(hour, e.target.value)}
              className="h-9 w-21 rounded-(--radius) border border-input-border bg-background pr-9 pl-3 text-sm tabular-nums"
            >
              {minutes.map((m) => (
                <option key={m} value={m} disabled={timeOff(hour, m)}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">UK time</span>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {value && !required ? (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  onChange?.("");
                }}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition-[filter] hover:brightness-110"
            >
              Done
            </button>
          </div>
        </div>
      </div>,
            document.body,
          )
        : null}
    </div>
  );
}
