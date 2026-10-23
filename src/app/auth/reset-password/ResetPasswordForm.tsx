"use client";

import { useActionState } from "react";

import { resetPasswordAction, skipPasswordAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function ResetPasswordForm({ invited = false }: { invited?: boolean }) {
  const [state, action] = useActionState(resetPasswordAction, initialState);

  return (
    <>
      <form action={action} className="space-y-5">
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}

        <Field
          label={invited ? "Password" : "New password"}
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

        <Field
          label={invited ? "Confirm password" : "Confirm new password"}
          name="confirmPassword"
          errors={state.fieldErrors?.confirmPassword}
        >
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
            errors={state.fieldErrors?.confirmPassword}
          />
        </Field>

        <SubmitButton
          size="lg"
          className="w-full"
          pendingLabel={invited ? "Saving…" : "Updating…"}
        >
          {invited ? "Save password" : "Update password"}
        </SubmitButton>
      </form>

      {/* A password is optional for an invitee (owner, 2026-10-23): accepting
        confirmed their address, so an email link or Google signs them in. */}
      {invited ? (
        <form
          action={skipPasswordAction}
          className="mt-6 rounded-(--radius-lg) border border-border p-5"
        >
          <p className="text-sm font-medium">Rather not use a password?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Skip it and sign in next time with an email link, or with Google if
            it uses this address. You can add a password later in Account,
            Security.
          </p>
          <Button type="submit" variant="outline" className="mt-4 w-full">
            Skip for now
          </Button>
        </form>
      ) : null}
    </>
  );
}
