"use client";

import { useActionState, useState } from "react";

import { saveRolesAction, type AdminState } from "@/app/admin/actions";
import { AdminCard, FormFooter } from "@/components/admin/AdminForm";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/utils/cn";

const initialState: AdminState = {};

type Role = { name: string; description: string | null };

const words = (name: string) => name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * A person's roles — note 06 §13.1.
 *
 * It lives on the PERSON, not on the roles page: you grant a role to somebody,
 * and the context for that decision (what they have bought, what they already
 * hold) is on this page.
 *
 * A LIST YOU EDIT, THEN SAVE (owner, 2026-10-14). The roles the person holds
 * are listed; "Add role" puts another on the list and "Remove" takes one off.
 * Nothing changes until Save, which makes every change at once with the one
 * reason given (`saveRolesAction`). Until then each new role is marked "To
 * add" and each removed one stays on the list, struck through, as "To
 * remove", with an undo, so what Save will do is always visible. It replaced
 * one role, a Grant / Revoke switch and a reason per change.
 */
export function RoleForm({
  userId,
  roles,
  held,
  ownerRoleLocked = false,
}: {
  userId: string;
  roles: Role[];
  held: string[];
  /** The operator is not an owner: the owner role is neither offered nor removable. */
  ownerRoleLocked?: boolean;
}) {
  const [state, action] = useActionState(saveRolesAction, initialState);
  const [chosen, setChosen] = useState<string[]>(held);
  const locked = (name: string) => ownerRoleLocked && name === "owner";
  const available = roles.filter((r) => !chosen.includes(r.name) && !locked(r.name));
  // Nothing picked until someone picks it: a pre-selected role read as one
  // already chosen (owner, 2026-10-23).
  const [adding, setAdding] = useState("");

  const toAdd = chosen.filter((r) => !held.includes(r));
  const toRemove = held.filter((r) => !chosen.includes(r));
  const changed = toAdd.length + toRemove.length > 0;
  // A reason is still recorded with every change, but need not be typed: it
  // starts as what is changing (owner, 2026-10-23).
  const defaultReason = [
    toAdd.length ? `Added ${toAdd.map(words).join(", ")}` : "",
    toRemove.length ? `Removed ${toRemove.map(words).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  // Held roles first, in their order, then the ones being added.
  const listed = [...held, ...toAdd];
  const describe = (name: string) => roles.find((r) => r.name === name)?.description;

  function add() {
    if (!adding || chosen.includes(adding)) return;
    const next = [...chosen, adding];
    setChosen(next);
    setAdding("");
  }

  return (
    <form action={action} className="max-w-3xl">
      <input type="hidden" name="userId" value={userId} />
      {chosen.map((r) => (
        <input key={r} type="hidden" name="roles" value={r} />
      ))}

      <AdminCard
        footer={
          <FormFooter
            note={
              changed
                ? `Save will ${[
                    toAdd.length ? `add ${toAdd.map(words).join(", ")}` : "",
                    toRemove.length ? `remove ${toRemove.map(words).join(", ")}` : "",
                  ]
                    .filter(Boolean)
                    .join(" and ")}. Only an owner can grant or remove the owner role; the database enforces that itself.`
                : "Only an owner can grant or remove the owner role; the database enforces that itself."
            }
          >
            {changed ? (
              <Button variant="ghost" onClick={() => setChosen(held)}>
                Discard changes
              </Button>
            ) : null}
            <SubmitButton pendingLabel="Saving…" disabled={!changed}>
              Save roles
            </SubmitButton>
          </FormFooter>
        }
      >
        <div className="space-y-5">
          {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}

          {listed.length === 0 ? (
            <p className="rounded-(--radius) border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              No staff roles. This account is a customer.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border">
              {listed.map((name) => {
                const removing = toRemove.includes(name);
                const isNew = toAdd.includes(name);
                return (
                  <li key={name} className={cn("flex items-center gap-3 px-4 py-3", removing && "bg-error/5")}>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", removing && "text-muted-foreground line-through")}>
                        {words(name)}
                      </p>
                      {describe(name) ? <p className="text-xs text-muted-foreground">{describe(name)}</p> : null}
                    </div>
                    {isNew ? (
                      <span className="shrink-0 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                        To add
                      </span>
                    ) : removing ? (
                      <span className="shrink-0 rounded-full border border-error/40 bg-error/10 px-2.5 py-0.5 text-xs font-medium text-error">
                        To remove
                      </span>
                    ) : null}
                    {locked(name) ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Only an owner can remove this</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChosen(removing ? [...chosen, name] : chosen.filter((r) => r !== name))}
                      >
                        {removing ? "Undo" : isNew ? "Cancel" : "Remove"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {available.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-56">
                <Field label="Add a role" name="add-role">
                  <Select name="add-role" value={adding} onChange={(e) => setAdding(e.target.value)} form="">
                    <option value="">Choose a role…</option>
                    {available.map((r) => (
                      <option key={r.name} value={r.name}>
                        {words(r.name)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button variant="outline" onClick={add} disabled={!adding}>
                Add role
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ownerRoleLocked ? "This account holds every role you can grant." : "This account holds every role there is."}
            </p>
          )}

          {changed ? (
            <Field
              label="Reason"
              name="reason"
              hint="Filled in for you; change it if you like. Recorded in the audit log against your account, with each change."
            >
              {/* Re-keyed on the changes, so the default follows the list. */}
              <Input key={defaultReason} name="reason" required defaultValue={defaultReason} />
            </Field>
          ) : null}
        </div>
      </AdminCard>
    </form>
  );
}
