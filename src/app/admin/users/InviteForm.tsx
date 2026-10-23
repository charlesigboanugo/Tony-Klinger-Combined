"use client";

import { useActionState, useState } from "react";

import { inviteUserAction, type AdminState } from "@/app/admin/actions";
import { AdminCard, FormFooter, FormGrid, Wide } from "@/components/admin/AdminForm";
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
  // The result Close was pressed on. A sent or failed invitation reopens the
  // form to show its message; once closed, that message stays dismissed (it
  // used to hold the form open, so Close did nothing after sending).
  const [dismissed, setDismissed] = useState<AdminState | null>(null);
  const message = state !== dismissed ? state : initialState;

  if (!open && !message.success && !message.error) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Invite someone
      </Button>
    );
  }

  // Full width, so in the toolbar's wrapping row it drops onto a line of its
  // own under the search instead of squeezing in beside it.
  return (
    <form action={action} className="w-full max-w-3xl">
      <AdminCard
        title="Invite someone"
        description="They receive a link to accept. They can choose a password, or sign in with an email link or Google instead. You never set a password for them."
        footer={
          <FormFooter note="An invitation creates a plain account. Give it a role afterwards from that person's own page.">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setDismissed(state);
              }}
            >
              Close
            </Button>
            <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
          </FormFooter>
        }
      >
        <FormGrid>
          {message.error || message.success ? (
            <Wide>
              {message.error ? <FormMessage>{message.error}</FormMessage> : null}
              {message.success ? <FormMessage tone="success">{message.success}</FormMessage> : null}
            </Wide>
          ) : null}

          <Field label="Email address" name="email">
            <Input name="email" type="email" required placeholder="name@example.com" />
          </Field>

          <Field label="Name" name="displayName" hint="Optional. They can change it themselves later.">
            <Input name="displayName" placeholder="Jane Smith" />
          </Field>

          <Wide>
            <Field label="Reason" name="reason" hint="Filled in for you; change it if you like. Recorded in the audit log against your account.">
              <Input name="reason" required defaultValue="Invited from Admin" />
            </Field>
          </Wide>
        </FormGrid>
      </AdminCard>
    </form>
  );
}
