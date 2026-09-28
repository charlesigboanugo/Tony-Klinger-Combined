"use client";

import { useActionState } from "react";

import { signUpAction } from "@/app/auth/actions";
import { AuthNotice } from "@/app/auth/AuthParts";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUpAction, initialState);

  if (state.success) {
    return <AuthNotice title="One last step">{state.success}</AuthNotice>;
  }

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Name" name="displayName" errors={state.fieldErrors?.displayName}>
        <Input
          name="displayName"
          autoComplete="name"
          required
          errors={state.fieldErrors?.displayName}
        />
      </Field>

      <Field label="Email" name="email" errors={state.fieldErrors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={state.fieldErrors?.email}
        />
      </Field>

      <Field
        label="Password"
        name="password"
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      >
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.password}
        />
      </Field>

      <SubmitButton size="lg" className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
