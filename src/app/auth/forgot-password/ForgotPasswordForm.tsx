"use client";

import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/auth/actions";
import { AuthNotice } from "@/app/auth/AuthParts";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialState);

  if (state.success) {
    return <AuthNotice title="Check your inbox">{state.success}</AuthNotice>;
  }

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <Field label="Email" name="email" errors={state.fieldErrors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={state.fieldErrors?.email}
        />
      </Field>

      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
