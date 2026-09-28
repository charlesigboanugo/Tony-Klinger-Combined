"use client";

import { useActionState } from "react";

import { updateProfileAction, type AccountFormState } from "@/app/account/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AccountFormState = {};

/** First and last name side by side from `sm`, display name full width beneath. */
export function ProfileForm({
  firstName,
  lastName,
  displayName,
}: {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}) {
  const [state, action] = useActionState(updateProfileAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" name="firstName">
          <Input name="firstName" defaultValue={firstName ?? ""} autoComplete="given-name" />
        </Field>
        <Field label="Last name" name="lastName">
          <Input name="lastName" defaultValue={lastName ?? ""} autoComplete="family-name" />
        </Field>
      </div>

      <Field label="Display name" name="displayName" hint="How we greet you here and in the Academy.">
        <Input name="displayName" defaultValue={displayName ?? ""} autoComplete="nickname" required />
      </Field>

      <div className="flex justify-end border-t border-border pt-5">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
