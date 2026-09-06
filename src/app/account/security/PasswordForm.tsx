"use client";

import { useActionState } from "react";

import { changePasswordAction, type AccountFormState } from "@/app/account/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AccountFormState = {};

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);

  return (
    <form action={action} className="max-w-md space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}

      <Field label="New password" name="password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" name="confirmPassword">
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <SubmitButton pendingLabel="Updating…">Change password</SubmitButton>
    </form>
  );
}
