"use client";

import { useActionState, useState } from "react";

import { resetMfaAction, type AdminState } from "@/app/admin/actions";
import { AdminCard, FormFooter } from "@/components/admin/AdminForm";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

/**
 * Security keys and authenticator apps on somebody else's account — note 05
 * §11.1.
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
  keys: Array<{ id: string; name: string; kind: "key" | "app"; created_at: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(resetMfaAction, initialState);

  const registered = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="max-w-3xl space-y-4">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}

      <AdminCard
        footer={
          keys.length > 0 && !open ? (
            <FormFooter note="Clearing removes every key and app, so the person signs in with their password alone until they set up a new one.">
              <Button variant="outline" onClick={() => setOpen(true)}>
                Clear all
              </Button>
            </FormFooter>
          ) : undefined
        }
      >
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No security key or authenticator app set up. This account signs in with a password alone.
          </p>
        ) : (
          <ul className="-my-3 divide-y divide-border">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center gap-3.5 py-3">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-success/40 bg-success/10 text-success"
                >
                  <Icon name={key.kind === "app" ? "phone" : "key"} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{key.name}</span>
                  <span className="block text-xs text-muted-foreground">{key.kind === "app" ? (key.name.startsWith("Authenticator app") ? "Added" : "Authenticator app · added") : "Security key · added"}{" "}
                    {registered(key.created_at)}</span>
                </span>
                <span className="shrink-0 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  Active
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {keys.length > 0 && open ? (
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <AdminCard
            tone="warning"
            title="Clear every key and app on this account?"
            description="They will sign in with their password alone until they set up a new one. Confirm who you are speaking to first: done carelessly, this is the step that turns a stolen inbox into a stolen account."
            footer={
              <FormFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="destructive" pendingLabel="Clearing…">
                  Clear all
                </SubmitButton>
              </FormFooter>
            }
          >
            <Field label="Reason" name="reason" hint="Filled in for you; change it if you like. Recorded in the audit log against your account.">
              <Input name="reason" required defaultValue="Lost access to their key or phone; identity confirmed" />
            </Field>
          </AdminCard>
        </form>
      ) : null}
    </div>
  );
}
