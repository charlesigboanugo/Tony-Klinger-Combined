"use client";

import { useActionState } from "react";

import { magicLinkAction } from "@/app/auth/actions";
import { AuthNotice } from "@/app/auth/AuthParts";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function MagicLinkForm({ next }: { next?: string }) {
  const [state, action] = useActionState(magicLinkAction, initialState);

  if (state.success) {
    return <AuthNotice title="Check your inbox">{state.success}</AuthNotice>;
  }

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        label="Email"
        name="magic-email"
        hint="We'll email you a link that signs you in. No password needed."
        errors={state.fieldErrors?.email}
      >
        <Input
          name="email"
          id="magic-email"
          type="email"
          autoComplete="email"
          required
          errors={state.fieldErrors?.email}
        />
      </Field>

      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
        Email me a link
      </SubmitButton>
    </form>
  );
}
