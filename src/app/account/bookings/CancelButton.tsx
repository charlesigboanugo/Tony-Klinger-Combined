"use client";

import { useActionState } from "react";

import { cancelBookingAction, type BookingState } from "@/app/bookings/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: BookingState = {};

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(cancelBookingAction, initialState);

  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;

  return (
    <form action={action}>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="bookingId" value={bookingId} />
      <SubmitButton variant="outline" pendingLabel="Cancelling…">
        Cancel
      </SubmitButton>
    </form>
  );
}
