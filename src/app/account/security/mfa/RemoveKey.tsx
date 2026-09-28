"use client";

import { useActionState, useState } from "react";

import { removeSecurityKeyAction, type KeyRemovalState } from "@/app/account/security/actions";
import { ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: KeyRemovalState = {};

/**
 * Remove one key — asks first, naming the key, because removal cannot be
 * undone from here (the key would have to be registered again). The database
 * decides whether it is allowed; this only presents the answer.
 */
export function RemoveKey({ factorId, name }: { factorId: string; name: string }) {
  const [state, action] = useActionState(removeSecurityKeyAction, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.reconfirm) {
    return (
      <div className="mt-3 w-full space-y-3">
        <FormMessage>
          For your safety, confirm it&apos;s you with one of your keys before removing one.
        </FormMessage>
        <ButtonLink href="/auth/2fa?confirm=1&next=/account/security/mfa" size="sm">
          Confirm with a key
        </ButtonLink>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-9 rounded-full border border-input-border px-4 text-sm font-medium transition-colors hover:border-error hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 w-full space-y-3 rounded-(--radius) border border-error/40 bg-error/5 p-4">
      <input type="hidden" name="factorId" value={factorId} />
      <p className="text-sm">
        Remove <strong>{name}</strong>? You won&apos;t be able to sign in with it any more.
      </p>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="destructive" size="sm" pendingLabel="Removing…">
          Remove key
        </SubmitButton>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-9 rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
