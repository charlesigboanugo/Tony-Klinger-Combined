"use client";

import { useActionState, useState } from "react";

import { teamMembershipAction, type AdminState } from "@/app/admin/actions";
import { AdminCard, FormFooter, FormGrid, Toggle, Wide } from "@/components/admin/AdminForm";
import { StatusPill } from "@/components/admin/AdminTable";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

type Entry = { id: string; name: string; role: string | null; status: string };

/**
 * Public team membership — note 06 §14.1.
 *
 * Says plainly that this grants nothing, because the obvious reading of "make
 * them a team member" is that it hands over some access. It does not: it puts a
 * name and a photograph on a public page.
 */
export function TeamForm({
  userId,
  defaultName,
  entry,
  unlinked,
}: {
  userId: string;
  defaultName: string;
  entry: Entry | null;
  unlinked: Array<{ id: string; name: string; role: string | null }>;
}) {
  const [state, action] = useActionState(teamMembershipAction, initialState);
  // The existing entry to link: none until one is picked (owner, 2026-10-23).
  const [linking, setLinking] = useState("");

  const message = (
    <>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}
    </>
  );

  if (entry) {
    return (
      <div className="max-w-3xl space-y-4">
        {message}
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="remove" />
          <AdminCard
            footer={
              <FormFooter note="Unlinking disconnects the account and leaves the published biography alone. Edit or remove the entry itself under Team.">
                <SubmitButton variant="outline" pendingLabel="Unlinking…">
                  Unlink from the team page
                </SubmitButton>
              </FormFooter>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Shown on the team page as</p>
                <p className="mt-0.5 truncate font-medium">
                  {entry.name}
                  {entry.role ? <span className="font-normal text-muted-foreground"> · {entry.role}</span> : null}
                </p>
              </div>
              <StatusPill value={entry.status} />
            </div>
            {entry.status === "published" ? null : (
              <p className="mt-3 text-sm text-warning">Not published, so it is not visible on the site yet.</p>
            )}
          </AdminCard>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {message}

      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="mode" value="create" />
        <AdminCard
          title="Add them to the team page"
          description="Creates a new entry for this person."
          footer={
            <FormFooter note="Appearing on the team page grants nothing. Roles are separate, and are set above.">
              <SubmitButton pendingLabel="Adding…">Add to the team page</SubmitButton>
            </FormFooter>
          }
        >
          <FormGrid>
            <Field label="Name as shown on the site" name="name">
              <Input name="name" required defaultValue={defaultName} />
            </Field>
            <Field label="Role" name="role" hint="Shown under the name, for example “Course tutor”.">
              <Input name="role" placeholder="Course tutor" />
            </Field>
            <Wide>
              <Toggle
                name="publish"
                defaultChecked
                label="Show on the team page straight away"
                hint="Turn off to create it as a draft, and add a photo and biography first."
              />
            </Wide>
          </FormGrid>
        </AdminCard>
      </form>

      {unlinked.length > 0 ? (
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="link" />
          <AdminCard
            title="Or connect an entry that already exists"
            description="These entries have no account attached. Pick one only if you know it is this person; nothing is matched automatically."
            footer={
              <FormFooter>
                <SubmitButton variant="outline" pendingLabel="Linking…" disabled={!linking}>
                  Link to this account
                </SubmitButton>
              </FormFooter>
            }
          >
            <Field label="Team entry" name="teamMemberId">
              <Select name="teamMemberId" required value={linking} onChange={(e) => setLinking(e.target.value)}>
                <option value="">Choose an entry…</option>
                {unlinked.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.role ? ` · ${member.role}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </AdminCard>
        </form>
      ) : null}
    </div>
  );
}
