"use client";

import { useActionState } from "react";

import { claimOrderAction, type ClaimState } from "@/app/account/claim/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/validation/newsletter-copy";

const initialState: ClaimState = {};

export function ClaimForm({ token, gift = false }: { token: string; gift?: boolean }) {
  const [state, action] = useActionState(claimOrderAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="token" value={token} />
      {gift ? (
        /*
          A gift's recipient did not buy, so soft opt-in does not reach them:
          this is the only way they join, and only if they tick it (owner,
          2026-10-25). Unticked, as on the newsletter form — a pre-ticked box
          is not consent.
        */
        <div className="flex gap-2.5">
          <input
            id="claim-news"
            name="news"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input-border accent-accent"
          />
          <label htmlFor="claim-news" className="text-xs text-muted-foreground">
            {NEWSLETTER_CONSENT_TEXT}
          </label>
        </div>
      ) : null}
      <SubmitButton className="w-full" pendingLabel={gift ? "Adding your gift…" : "Linking your purchase…"}>
        {gift ? "Add this gift to my account" : "Add this purchase to my account"}
      </SubmitButton>
    </form>
  );
}
