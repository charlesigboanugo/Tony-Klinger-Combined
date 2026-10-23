"use client";

import { useActionState } from "react";

import { enrolInIntakeAction, type EnrolState } from "@/app/academy/cohorts/actions";
import { FormMessage } from "@/components/ui/Field";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";

/**
 * Choose the intake for a cohort already paid for — migration 0017.
 *
 * Shown only when paying could not place the buyer by itself: the cohort has
 * two intakes open, so the choice is theirs.
 */
export function IntakeChooser({
  intakes,
}: {
  intakes: Array<{ id: string; label: string; dates: string; places: string | null }>;
}) {
  const [state, action] = useActionState<EnrolState, FormData>(enrolInIntakeAction, {});

  return (
    <div className="mt-4">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <ul className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border">
        {intakes.map((intake) => (
          <li key={intake.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="font-medium">{intake.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {intake.dates}
                {intake.places ? ` · ${intake.places}` : ""}
              </p>
            </div>
            <form action={action} className="shrink-0">
              <input type="hidden" name="intake" value={intake.id} />
              <ConfirmSubmit
                size="sm"
                pendingLabel="Joining…"
                title={`Join ${intake.label}?`}
                points={[
                  `It runs ${intake.dates}.`,
                  "This takes the cohort place you have paid for.",
                  "Your place is kept in every workshop. There is nothing to book.",
                ]}
                note="Once you have joined an intake it cannot be swapped for another. If you need to change it, get in touch."
                confirmLabel="Yes, join it"
              >
                Join this intake
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
