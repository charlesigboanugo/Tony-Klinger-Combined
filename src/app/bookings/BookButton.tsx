"use client";

import { useActionState } from "react";

import { bookSessionAction, type BookingState } from "@/app/bookings/actions";
import { ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: BookingState = {};

/**
 * Confirms a place. Once booked, the task is over, so the button gives way to
 * clear next steps — the booking itself, the Academy, more sessions — rather
 * than leaving a success message and nowhere obvious to go (note 04 §20).
 */
export function BookButton({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState(bookSessionAction, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">{state.success}</FormMessage>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/account/bookings">View your bookings</ButtonLink>
          <ButtonLink href="/academy/coaching" variant="outline">
            Academy coaching
          </ButtonLink>
          <ButtonLink href="/bookings" variant="ghost">
            Book another
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton pendingLabel="Booking…">Confirm this place</SubmitButton>
    </form>
  );
}
