"use client";

import { useActionState } from "react";

import { teamMembershipAction, type AdminState } from "@/app/admin/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
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
      <div className="max-w-lg space-y-4">
        {message}
        <p className="text-sm">
          Shown on the team page as{" "}
          <span className="font-medium">{entry.name}</span>
          {entry.role ? ` — ${entry.role}` : ""}.{" "}
          {entry.status === "published" ? (
            <span className="text-success">Published.</span>
          ) : (
            <span className="text-warning">
              Not published, so it is not visible yet.
            </span>
          )}
        </p>
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="remove" />
          <SubmitButton variant="outline" pendingLabel="Unlinking…">
            Unlink from the team page
          </SubmitButton>
        </form>
        <p className="text-sm text-muted-foreground">
          Unlinking disconnects the account and leaves the published biography
          alone. Edit or remove the entry itself under Team.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-8">
      {message}

      <form action={action} className="space-y-5">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="mode" value="create" />

        <Field label="Name as shown on the site" name="name">
          <Input name="name" required defaultValue={defaultName} />
        </Field>

        <Field
          label="Role"
          name="role"
          hint="Shown under the name — e.g. “Course tutor”."
        >
          <Input name="role" placeholder="Course tutor" />
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="publish"
            defaultChecked
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Show on the public team page straight away. Untick to create it as a
            draft and add a photo and biography first.
          </span>
        </label>

        <SubmitButton pendingLabel="Adding…">Add to the team page</SubmitButton>
      </form>

      {unlinked.length > 0 ? (
        <form action={action} className="space-y-3 border-t border-border pt-6">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="link" />

          <h3 className="text-sm font-medium">
            Or connect an entry that already exists
          </h3>
          <p className="text-sm text-muted-foreground">
            These entries have no account attached. Pick one only if you know it
            is this person — nothing is matched automatically.
          </p>

          <select
            name="teamMemberId"
            required
            className="h-11 w-full rounded-(--radius) border border-border bg-background px-3 text-base"
          >
            {unlinked.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.role ? ` — ${member.role}` : ""}
              </option>
            ))}
          </select>

          <SubmitButton variant="outline" pendingLabel="Linking…">
            Link to this account
          </SubmitButton>
        </form>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Appearing on the team page grants nothing. Roles are separate, and are
        set above.
      </p>
    </div>
  );
}
