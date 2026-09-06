"use client";

import { useActionState } from "react";

import { signUpAction } from "@/app/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUpAction, initialState);

  if (state.success) {
    return <FormMessage tone="success">{state.success}</FormMessage>;
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
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.password}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
