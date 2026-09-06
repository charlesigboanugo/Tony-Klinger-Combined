"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/app/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <Field
        label="New password"
        name="password"
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.password}
        />
      </Field>

      <Field
        label="Confirm new password"
        name="confirmPassword"
        errors={state.fieldErrors?.confirmPassword}
      >
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.confirmPassword}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
