"use client";

import { useActionState, useState } from "react";

import { inviteUserAction, type AdminState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

/**
 * Invite a person to hold an account — note 06 §14.2.
 *
 * COLLAPSED BY DEFAULT. Inviting is rare next to looking somebody up, and a
 * form permanently open above the list would push the thing people actually
 * came for below the fold every time.
 */
export function InviteForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(inviteUserAction, initialState);

  if (!open && !state.success && !state.error) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Invite someone
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="max-w-lg space-y-5 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card"
    >
      <div>
        <h2 className="font-display text-lg font-semibold">Invite someone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          They receive a link and choose their own password. You never set it,
          so the account stays provably theirs.
        </p>
      </div>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <Field label="Email address" name="email">
        <Input name="email" type="email" required placeholder="name@example.com" />
      </Field>

      <Field
        label="Name"
        name="displayName"
        hint="Optional. They can change it themselves later."
      >
        <Input name="displayName" placeholder="Jane Smith" />
      </Field>

      <Field
        label="Reason"
        name="reason"
        hint="Recorded in the audit log against your account. Required."
      >
        <Input name="reason" required placeholder="Joining as a course tutor" />
      </Field>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        An invitation creates a plain account. Give it a role afterwards from
        that person&apos;s own page.
      </p>
    </form>
  );
}
