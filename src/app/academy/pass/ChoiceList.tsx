"use client";

import { useActionState } from "react";

import { choosePlaylistAction, type ChoiceState } from "@/app/academy/pass/actions";
import { FormMessage } from "@/components/ui/Field";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";

/**
 * The playlists a member may still choose, each with its own button.
 *
 * A choice is kept for the life of the membership, so the list says so before
 * the button is pressed rather than after — and the button names what is being
 * chosen, so nobody presses "Choose" on the wrong row.
 */
export function ChoiceList({
  items,
  remaining,
  held,
}: {
  items: Array<{ id: string; name: string; description: string | null }>;
  remaining: number;
  /** How many the member has already chosen. */
  held: number;
}) {
  const [state, action] = useActionState<ChoiceState, FormData>(choosePlaylistAction, {});

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {held === 0
          ? remaining === 1
            ? "Choose your playlist."
            : `Choose your ${remaining} playlists.`
          : remaining === 1
            ? "Choose one more."
            : `Choose ${remaining} more.`}{" "}
        Your choice stays with your pass, so take a moment over it. To change it later, get in touch.
      </p>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="font-medium">{item.name}</p>
              {item.description ? (
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <form action={action} className="shrink-0">
              <input type="hidden" name="id" value={item.id} />
              <ConfirmSubmit
                size="sm"
                variant="outline"
                pendingLabel="Saving…"
                title={`Choose ${item.name} as your playlist?`}
                points={[
                  remaining === 1
                    ? "Your pass includes one playlist of your choice, and this will be it."
                    : `This uses one of the ${remaining} playlists you still have to choose.`,
                  "You can watch it straight away, and new videos appear in it as they are added.",
                ]}
                note="The choice stays with your pass and cannot be changed here. To change it later, get in touch."
                confirmLabel={`Yes, choose ${item.name}`}
              >
                Choose {item.name}
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
