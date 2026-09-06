"use client";

import { useActionState } from "react";

import { updateProfileAction, type AccountFormState } from "@/app/account/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AccountFormState = {};

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
    <form action={action} className="max-w-md space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}

      <Field label="Display name" name="displayName">
        <Input name="displayName" defaultValue={displayName ?? ""} required />
      </Field>
      <Field label="First name" name="firstName">
        <Input name="firstName" defaultValue={firstName ?? ""} />
      </Field>
      <Field label="Last name" name="lastName">
        <Input name="lastName" defaultValue={lastName ?? ""} />
      </Field>

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
