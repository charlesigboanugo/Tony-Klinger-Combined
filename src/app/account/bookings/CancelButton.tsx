"use client";

import { useActionState } from "react";

import { cancelBookingAction, type BookingState } from "@/app/book/actions";
import { FormMessage } from "@/components/ui/Field";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";

const initialState: BookingState = {};

export function CancelButton({
  bookingId,
  what,
  when,
  kind,
}: {
  bookingId: string;
  /** What is being cancelled, for the question: "Advanced One-to-One Coaching". */
  what: string;
  /** Its date, in words. */
  when: string | null;
  kind: "private_coaching" | "event" | "other";
}) {
  const [state, action] = useActionState(cancelBookingAction, initialState);

  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;

  return (
    <form action={action}>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="bookingId" value={bookingId} />
      {/* Asked first (owner, 2026-10-10): it gives a place up. */}
      <ConfirmSubmit
        variant="outline"
        pendingLabel="Cancelling…"
        destructive
        title={`Cancel ${what}?`}
        points={[
          ...(when ? [`It is booked for ${when}.`] : []),
          kind === "private_coaching"
            ? "If it is at least 48 hours away, the session is returned to your account to book again. Inside 48 hours it is used."
            : kind === "event"
              ? "Your place is given up and offered to the next person on the waiting list."
              : "Your place is given up.",
        ]}
        note="This cannot be undone. To come after all you would need to book again, if a place is still free."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep it"
      >
        Cancel
      </ConfirmSubmit>
    </form>
  );
}
