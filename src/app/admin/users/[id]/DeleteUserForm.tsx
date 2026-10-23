"use client";

import { useActionState } from "react";

import { deleteUserAction, type AdminState } from "@/app/admin/actions";
import { AdminCard, FormFooter } from "@/components/admin/AdminForm";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { Field, FormMessage, Input } from "@/components/ui/Field";

const initialState: AdminState = {};

/**
 * Delete this account — note 06 §14.4.
 *
 * Shown only to someone who may delete accounts. While anything is still
 * live on the account (`blockers`), it says what and offers no button; the
 * action checks again on submit in case something changed. Otherwise it takes
 * a reason and asks for confirmation, saying plainly what goes and what stays.
 */
export function DeleteUserForm({
  userId,
  email,
  blockers,
}: {
  userId: string;
  email: string | null;
  blockers: string[];
}) {
  const [state, action] = useActionState(deleteUserAction, initialState);

  if (blockers.length > 0) {
    return (
      <AdminCard tone="danger" className="max-w-3xl">
        <p className="text-sm font-medium">This account cannot be deleted yet, because:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </AdminCard>
    );
  }

  return (
    <form action={action} className="max-w-3xl">
      <input type="hidden" name="userId" value={userId} />
      <AdminCard
        tone="danger"
        footer={
          <FormFooter note="Nothing on this account is live and it has never ordered: no staff role, no access in force, no bookings to come.">
            <ConfirmSubmit
              variant="destructive"
              destructive
              pendingLabel="Deleting…"
              title={`Delete ${email ?? "this account"}?`}
              points={[
                "They can no longer sign in, and their account, past bookings, registrations and expired access are removed.",
                "The deletion and your reason are kept in the audit log.",
              ]}
              note="This is permanent. It cannot be undone."
              confirmLabel="Yes, delete the account"
              cancelLabel="Keep it"
            >
              Delete account
            </ConfirmSubmit>
          </FormFooter>
        }
      >
        <div className="space-y-4">
          {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          <Field label="Reason" name="reason" hint="Filled in for you; change it if you like. Recorded in the audit log against your account.">
            <Input name="reason" required defaultValue="Account closed at the person's request" />
          </Field>
        </div>
      </AdminCard>
    </form>
  );
}
