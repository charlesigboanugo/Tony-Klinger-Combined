"use client";

import { useActionState, useState } from "react";

import { bookPrivateSlotAction, type PrivateBookingState } from "@/app/book/private/actions";
import { FormMessage } from "@/components/ui/Field";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { cn } from "@/lib/utils/cn";

const initialState: PrivateBookingState = {};

export type SlotDay = {
  /** "Monday 12 October" — the whole date, for the summary and assistive tech. */
  label: string;
  /** "Mon" */
  weekday: string;
  /** "12" */
  dayOfMonth: string;
  slots: Array<{ id: string; time: string }>;
};

/** The days of one month, under its name: "October 2026". */
export type SlotWeek = { label: string; days: SlotDay[] };

/**
 * Choose one open time, then continue — note 09 §35.
 *
 * A DIARY, NOT A LIST (owner, 2026-10-09: "structured well, a good layout").
 * It was one long column: a date, one time under it, the next date. Nine days
 * meant scrolling past nine headings to compare times that all fit on a
 * screen. Now the days sit side by side as a grid of date tiles, under the
 * month they fall in, each with its times inside it; and what has been chosen is said back
 * in a bar with the button, which stays in view on a phone. A choice can be
 * undone: press the chosen time again, or "Clear" in the bar.
 *
 * Times arrive already formatted in UK time from the server, so nothing here
 * reads the clock or the time zone.
 */
export function SlotPicker({ weeks, submitLabel }: { weeks: SlotWeek[]; submitLabel: string }) {
  const [state, action] = useActionState(bookPrivateSlotAction, initialState);
  const [chosen, setChosen] = useState<string | null>(null);

  const picked = weeks
    .flatMap((w) => w.days)
    .flatMap((d) => d.slots.map((s) => ({ ...s, day: d.label })))
    .find((s) => s.id === chosen);

  return (
    <form action={action}>
      {state.error ? (
        <div className="mb-6">
          <FormMessage>{state.error}</FormMessage>
        </div>
      ) : null}

      <div className="space-y-10">
        {weeks.map((week) => (
          <section key={week.label} aria-label={week.label}>
            <h2 className="mb-4 flex items-baseline gap-2 border-b border-border pb-2 font-sans text-base font-semibold">
              {week.label}
              <span className="text-sm font-normal text-muted-foreground">
                {week.days.reduce((n, d) => n + d.slots.length, 0)} open
              </span>
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {week.days.map((day) => {
                const holdsChoice = day.slots.some((s) => s.id === chosen);
                return (
                  <fieldset
                    key={day.label}
                    className={cn(
                      "rounded-(--radius-lg) border bg-surface p-3 transition-[border-color,box-shadow] duration-(--dur-fast)",
                      holdsChoice ? "border-accent shadow-card ring-1 ring-accent/30" : "border-border",
                    )}
                  >
                    <legend className="sr-only">{day.label}</legend>
                    {/* The date as a tile head: weekday, then the day large. */}
                    {/* The month is the heading above, so the tile does not repeat it. */}
                    <p aria-hidden="true" className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {day.weekday}
                    </p>
                    <p aria-hidden="true" className="px-1 font-display text-3xl leading-tight font-semibold tabular-nums">
                      {day.dayOfMonth}
                    </p>

                    <div className="mt-3 grid gap-2">
                      {day.slots.map((slot) => (
                        <label
                          key={slot.id}
                          className="cursor-pointer rounded-(--radius) border border-input-border px-3 py-2.5 text-center text-sm font-semibold tabular-nums transition-colors hover:border-accent hover:bg-accent/8 has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                        >
                          <input
                            type="radio"
                            name="slotId"
                            value={slot.id}
                            className="sr-only"
                            aria-label={`${day.label}, ${slot.time}`}
                            checked={chosen === slot.id}
                            onChange={() => setChosen(slot.id)}
                            // A radio cannot be un-chosen by itself; pressing the
                            // chosen time again clears it (owner, 2026-10-09).
                            onClick={() => {
                              if (chosen === slot.id) setChosen(null);
                            }}
                          />
                          {slot.time}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* What has been chosen, said back, with the button. Stays at the foot
          of the screen on a phone so it is never a scroll away. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-10 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:rounded-(--radius-lg) sm:border sm:bg-surface sm:p-5 sm:shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="min-w-0 text-sm" aria-live="polite">
            {picked ? (
              <>
                <span className="block text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Your time
                </span>
                <span className="block text-base font-semibold">
                  {picked.day}, {picked.time}
                </span>
                <button
                  type="button"
                  onClick={() => setChosen(null)}
                  className="mt-1 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Clear
                </button>
              </>
            ) : (
              <span className="text-muted-foreground">Pick a time above to continue.</span>
            )}
          </p>
          <ConfirmSubmit
            pendingLabel="Booking your time…"
            disabled={!chosen}
            className="w-full shrink-0 sm:w-auto"
            title="Book this time?"
            points={[
              picked ? `${picked.day}, ${picked.time}, UK time.` : "The time you have chosen.",
              "This uses one of the sessions you have paid for.",
            ]}
            note="You can cancel up to 48 hours before it and the session is returned to your account to book again."
            confirmLabel="Yes, book it"
          >
            {submitLabel}
          </ConfirmSubmit>
        </div>
      </div>
    </form>
  );
}
