"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/app/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      {/* Carried through the form so the destination survives a failed attempt. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email" name="email" errors={state.fieldErrors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={state.fieldErrors?.email}
        />
      </Field>

      <div className="space-y-2">
        <Field label="Password" name="password" errors={state.fieldErrors?.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            required
            errors={state.fieldErrors?.password}
          />
        </Field>
        <p className="text-right">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-muted-foreground underline decoration-current/40 underline-offset-4 transition-colors hover:text-accent hover:decoration-current"
          >
            Forgot your password?
          </Link>
        </p>
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
