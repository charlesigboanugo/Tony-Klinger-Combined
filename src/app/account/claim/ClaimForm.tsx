"use client";

import { useActionState } from "react";

import { claimOrderAction, type ClaimState } from "@/app/account/claim/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: ClaimState = {};

export function ClaimForm({ token }: { token: string }) {
  const [state, action] = useActionState(claimOrderAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" pendingLabel="Linking your purchase…">
        Add this purchase to my account
      </SubmitButton>
    </form>
  );
}
