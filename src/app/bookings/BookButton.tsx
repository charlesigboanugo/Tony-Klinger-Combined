"use client";

import { useActionState } from "react";

import { bookSessionAction, type BookingState } from "@/app/bookings/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: BookingState = {};

export function BookButton({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState(bookSessionAction, initialState);

  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;

  return (
    <form action={action} className="space-y-3">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton pendingLabel="Booking…">Confirm this place</SubmitButton>
    </form>
  );
}
