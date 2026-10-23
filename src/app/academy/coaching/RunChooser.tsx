"use client";

import { useActionState } from "react";

import { registerForRunAction, type RegisterState } from "@/app/academy/coaching/actions";
import { FormMessage } from "@/components/ui/Field";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";

/**
 * Register for a run of a series.
 *
 * Two uses. A pass holder registers for a series against their number for the
 * year (Academy → Your pass): one row per series open for registration. And
 * somebody who paid for a series when no run had a place takes that place once
 * a run does (Academy → Coaching): a single row, since one run of a series
 * takes registrations at a time (migration 0021).
 */
export function RunChooser({
  runs,
}: {
  runs: Array<{
    id: string;
    label: string;
    dates: string;
    placesLeft: number;
    note?: string;
    /** What registering uses up, said in the confirmation: a series of a pass, or a place paid for. */
    uses?: string;
  }>;
}) {
  const [state, action] = useActionState<RegisterState, FormData>(registerForRunAction, {});

  return (
    <div className="mt-4">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <ul className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border">
        {runs.map((run) => (
          <li key={run.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="font-medium">{run.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {run.dates} · {run.placesLeft} place{run.placesLeft === 1 ? "" : "s"} left
              </p>
              {run.note ? <p className="mt-1 text-sm font-medium text-accent">{run.note}</p> : null}
            </div>
            <form action={action} className="shrink-0">
              <input type="hidden" name="run" value={run.id} />
              {/* Asked first: registering uses something up and is not undone here. */}
              <ConfirmSubmit
                size="sm"
                pendingLabel="Registering…"
                title={`Register for ${run.label}?`}
                points={[
                  `It runs from ${run.dates}.`,
                  "Your seat is kept in all eight sessions. There is nothing to book.",
                  run.uses ?? "This takes the place you have paid for on this series.",
                ]}
                note="Once you are registered it cannot be swapped for another series or other dates. If you need to change it, get in touch."
                confirmLabel="Yes, register me"
              >
                Register for these dates
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
