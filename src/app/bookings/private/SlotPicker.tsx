"use client";

import { useActionState, useState } from "react";

import { bookPrivateSlotAction, type PrivateBookingState } from "@/app/bookings/private/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: PrivateBookingState = {};

export type SlotDay = {
  label: string;
  slots: Array<{ id: string; time: string }>;
};

/**
 * Choose one open time, then continue. Times arrive already formatted in UK
 * time from the server, so nothing here reads the clock or the time zone.
 */
export function SlotPicker({ days, submitLabel }: { days: SlotDay[]; submitLabel: string }) {
  const [state, action] = useActionState(bookPrivateSlotAction, initialState);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-8">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      {days.map((day) => (
        <fieldset key={day.label}>
          <legend className="mb-3 text-sm font-semibold">{day.label}</legend>
          <div className="flex flex-wrap gap-2">
            {day.slots.map((slot) => (
              <label
                key={slot.id}
                className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium tabular-nums transition-colors hover:border-foreground/40 has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
              >
                <input
                  type="radio"
                  name="slotId"
                  value={slot.id}
                  className="sr-only"
                  onChange={() => setChosen(slot.id)}
                />
                {slot.time}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="border-t border-border pt-6">
        <SubmitButton pendingLabel="Holding your time…" disabled={!chosen} className="w-full sm:w-auto">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
