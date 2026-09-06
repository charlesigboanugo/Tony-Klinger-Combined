"use client";

import { useActionState } from "react";

import { setRoleAction, type AdminState } from "@/app/admin/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

/**
 * Role assignment — note 06 §13.1.
 *
 * It lives on the PERSON, not on the roles page: you grant a role to somebody,
 * and the context for that decision — what they have bought, what they already
 * hold — is on this page.
 *
 * One form rather than a button beside each role, because every change carries
 * a reason and a reason field repeated per role would be six inputs where one
 * will do. It is an ordinary form, so it works before hydration.
 */
export function RoleForm({
  userId,
  roles,
  held,
}: {
  userId: string;
  roles: string[];
  held: string[];
}) {
  const [state, action] = useActionState(setRoleAction, initialState);

  return (
    <form action={action} className="max-w-lg space-y-5">
      <input type="hidden" name="userId" value={userId} />

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="role" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          defaultValue={roles.find((r) => !held.includes(r)) ?? roles[0]}
          className="h-11 w-full rounded-(--radius) border border-border bg-background px-3 text-base"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role.replace(/_/g, " ")}
              {held.includes(role) ? " — currently held" : ""}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium">Change</legend>
        <div className="flex gap-4">
          {(
            [
              ["grant", "Grant"],
              ["revoke", "Revoke"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="grant"
                value={value}
                defaultChecked={value === "grant"}
                className="size-4 accent-[var(--color-primary)]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Reason"
        name="reason"
        hint="Recorded in the audit log against your account. Required."
      >
        <Input name="reason" required placeholder="Joining the support team" />
      </Field>

      <SubmitButton pendingLabel="Applying…">Apply change</SubmitButton>

      <p className="text-sm text-muted-foreground">
        Only an owner can grant the owner role, and the database enforces that
        independently of this form (note 06 §34).
      </p>
    </form>
  );
}
