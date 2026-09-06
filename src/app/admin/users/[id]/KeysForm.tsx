"use client";

import { useActionState, useState } from "react";

import { resetMfaAction, type AdminState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

/**
 * Security keys on somebody else's account — note 05 §11.1.
 *
 * Clearing them is destructive and is the one control here that hands an
 * account back to whoever asks convincingly enough, so it is deliberately not a
 * single button: it opens, it demands a written reason, and it says in plain
 * words what will happen. The database refuses the cases the interface should
 * never offer — an owner, or a staff member when the operator is not an owner.
 */
export function KeysForm({
  userId,
  keys,
}: {
  userId: string;
  keys: Array<{ id: string; name: string; created_at: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(resetMfaAction, initialState);

  return (
    <div className="max-w-lg space-y-4">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No security keys registered. This account signs in with a password
          alone.
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-baseline gap-2">
              <span aria-hidden="true" className="text-success">
                &#10003;
              </span>
              <span className="font-medium">{key.name}</span>
              <span className="text-muted-foreground">
                registered{" "}
                {new Date(key.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {keys.length > 0 ? (
        open ? (
          <form
            action={action}
            className="space-y-4 rounded-(--radius-lg) border border-warning/50 bg-surface p-5"
          >
            <input type="hidden" name="userId" value={userId} />

            <p className="text-sm">
              This removes every key on the account. They will sign in with
              their password alone until they register a new one, so confirm who
              you are speaking to first — this is the step that turns a stolen
              inbox into a stolen account if it is done carelessly.
            </p>

            <Field
              label="Reason"
              name="reason"
              hint="Recorded in the audit log against your account. Required."
            >
              <Input
                name="reason"
                required
                placeholder="Lost phone, identity confirmed by phone call"
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <SubmitButton variant="destructive" pendingLabel="Clearing…">
                Clear all keys
              </SubmitButton>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Clear security keys
          </Button>
        )
      ) : null}
    </div>
  );
}
