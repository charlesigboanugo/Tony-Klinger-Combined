"use client";

import { useActionState, useState } from "react";

import { grantEntitlementAction, type AdminState } from "@/app/admin/actions";
import { FormGrid, Wide } from "@/components/admin/AdminForm";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

type GrantGroup = { kind: string; label: string; options: Array<{ value: string; name: string }> };

/** Kinds held as a number of sessions; the rest are plain access. */
const COUNTED = ["private_coaching", "group_coaching_session"];

/**
 * Manual entitlement grant — note 06 §23.1.
 *
 * WHAT TO GIVE IS PICKED BY NAME (owner, 2026-10-15): one list of every
 * course, pass, cohort, series, service, retreat, event and playlist, grouped
 * by kind, in place of a type dropdown plus an id to paste. The number of
 * sessions is asked only for what is held as sessions.
 *
 * The reason field is required, not optional: a grant with no reason is
 * indistinguishable from a mistake or an abuse of privilege.
 */
export function GrantForm({ groups }: { groups: GrantGroup[] }) {
  const [state, action] = useActionState(grantEntitlementAction, initialState);
  const [item, setItem] = useState("");
  const kind = item.slice(0, item.indexOf(":"));

  return (
    <form action={action}>
      <FormGrid>
        {state.error || state.success ? (
          <Wide>
            {state.error ? <FormMessage>{state.error}</FormMessage> : null}
            {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}
          </Wide>
        ) : null}

        <Field label="Customer email" name="userId" hint="The email address on their account.">
          <Input name="userId" type="email" required placeholder="name@example.com" />
        </Field>

        <Field
          label="What to give"
          name="item"
          hint={kind === "membership" ? "A Coaching Pass given here has no end date until you revoke it." : undefined}
        >
          <Select name="item" required value={item} onChange={(event) => setItem(event.target.value)}>
            <option value="">Choose…</option>
            {groups
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <optgroup key={group.kind} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </Select>
        </Field>

        {COUNTED.includes(kind) ? (
          <Field label="Number of sessions" name="quantity">
            <Input name="quantity" type="number" min={1} required defaultValue={1} />
          </Field>
        ) : null}

        <Wide>
          <Field label="Reason" name="reason" hint="Filled in for you; change it if you like. Recorded in the audit log.">
            <Input name="reason" required defaultValue="Access given from Admin" />
          </Field>
        </Wide>

        <Wide className="flex justify-end border-t border-border pt-5">
          <SubmitButton pendingLabel="Granting…">Grant access</SubmitButton>
        </Wide>
      </FormGrid>
    </form>
  );
}
