"use client";

import { useActionState } from "react";

import { grantEntitlementAction, type AdminState } from "@/app/admin/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

const RESOURCE_TYPES = [
  "course", "group_coaching_series", "group_coaching_session", "cohort",
  "retreat", "event", "masterclass", "resource", "release", "partner_discount",
];

/**
 * Manual entitlement grant — note 06 §23.1.
 *
 * The reason field is required, not optional: a grant with no reason is
 * indistinguishable from a mistake or an abuse of privilege.
 */
export function GrantForm() {
  const [state, action] = useActionState(grantEntitlementAction, initialState);

  return (
    <form action={action} className="max-w-lg space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}

      <Field label="Customer user id" name="userId">
        <Input name="userId" required placeholder="00000000-0000-…" />
      </Field>

      <div className="space-y-2">
        <label htmlFor="resourceType" className="block text-sm font-medium">
          Resource type
        </label>
        <select
          id="resourceType"
          name="resourceType"
          required
          className="h-11 w-full rounded-(--radius) border border-border bg-background px-3 text-base"
        >
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <Field label="Resource id" name="resourceId" hint="Leave blank to cover the whole type.">
        <Input name="resourceId" />
      </Field>

      <Field label="Quantity" name="quantity" hint="Blank for unlimited access; a number for consumable credits.">
        <Input name="quantity" type="number" min={1} />
      </Field>

      <Field label="Reason" name="reason" hint="Recorded in the audit log. Required.">
        <Input name="reason" required placeholder="Goodwill after support ticket #123" />
      </Field>

      <SubmitButton pendingLabel="Granting…">Grant access</SubmitButton>
    </form>
  );
}
