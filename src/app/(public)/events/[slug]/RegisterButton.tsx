"use client";

import { useActionState } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import {
  joinWaitlistAction,
  registerForEventAction,
  type EventActionState,
} from "./actions";

const initialState: EventActionState = {};

type Props = { eventId: string; slug: string };

/** Sign in, or create an account, and come back to this event's panel. */
function SignInPrompt({ slug, message }: { slug: string; message?: string }) {
  const next = encodeURIComponent(`/events/${slug}#register`);
  return (
    <div className="space-y-3">
      {message ? <FormMessage>{message}</FormMessage> : null}
      <ButtonLink href={`/auth/sign-in?next=${next}`} className="w-full">
        Sign in
      </ButtonLink>
      <ButtonLink href={`/auth/sign-up?next=${next}`} variant="outline" className="w-full">
        Create a free account
      </ButtonLink>
    </div>
  );
}

export function RegisterButton({ eventId, slug }: Props) {
  const [state, action] = useActionState(registerForEventAction, initialState);

  if (state.success) {
    return (
      <div className="space-y-3">
        <FormMessage tone="success">{state.success}</FormMessage>
        <ButtonLink href={state.bookingId ? `/account/tickets/${state.bookingId}` : "/account/bookings"} className="w-full">
          View my ticket
        </ButtonLink>
      </div>
    );
  }

  if (state.signIn) return <SignInPrompt slug={slug} message={state.error} />;

  return (
    <form action={action} className="space-y-3">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <SubmitButton pendingLabel="Holding your place…" className="w-full">
        Register a free place
      </SubmitButton>
    </form>
  );
}

export function WaitlistButton({ eventId, slug }: Props) {
  const [state, action] = useActionState(joinWaitlistAction, initialState);

  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;
  if (state.signIn) return <SignInPrompt slug={slug} message={state.error} />;

  return (
    <form action={action} className="space-y-3">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <SubmitButton pendingLabel="Adding you…" variant="outline" className="w-full">
        Join the waiting list
      </SubmitButton>
    </form>
  );
}
