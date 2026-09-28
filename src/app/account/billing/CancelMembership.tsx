"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cancelMembershipAction } from "@/app/account/billing/actions";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";

const CLOSE_MS = 200;

const REASONS: Array<[value: string, label: string]> = [
  ["too_expensive", "It's too expensive"],
  ["unused", "I'm not using it enough"],
  ["missing_features", "It doesn't have what I need"],
  ["switched_service", "I've found an alternative"],
  ["other", "Another reason"],
];

const control =
  "w-full rounded-(--radius) border border-input-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Cancel a membership on the site — a native modal `<dialog>` (focus trapped,
 * Escape closes, the page behind is inert), animated in and out like the
 * newsletter dialog. Says exactly what happens before asking: access to the
 * end of the paid period, no further charge, and that it can be undone.
 */
export function CancelMembership({
  subscriptionId,
  tierName,
  accessUntil,
}: {
  subscriptionId: string;
  tierName: string;
  accessUntil: string | null;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    const el = dialog.current;
    if (!el || el.open) return;
    el.showModal();
    requestAnimationFrame(() => setOpen(true));
  };

  const hide = useCallback(() => {
    const el = dialog.current;
    if (!el?.open) return;
    setOpen(false);
    window.setTimeout(() => el.close(), CLOSE_MS);
  }, []);

  // Escape animates out rather than vanishing.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      hide();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [hide]);

  return (
    <>
      {/* A button, not a link: it acts here rather than going somewhere.
          Outline, like "Update card" — the dialog carries the red one. */}
      <Button type="button" variant="outline" size="sm" onClick={show} aria-haspopup="dialog">
        Cancel membership
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby="cancel-title"
        data-open={open}
        // A click on the backdrop (the dialog itself, outside the panel) closes.
        onClick={(e) => {
          if (e.target === e.currentTarget) hide();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg bg-transparent p-0 backdrop:bg-black/0 backdrop:transition-[background-color] backdrop:duration-(--dur-base) data-[open=true]:backdrop:bg-black/50"
      >
        <div className="scale-95 rounded-(--radius-lg) border border-border bg-surface p-6 text-foreground opacity-0 shadow-lift transition-[opacity,transform] duration-200 ease-out in-data-[open=true]:scale-100 in-data-[open=true]:opacity-100 motion-reduce:transition-none sm:p-7">
          <h2 id="cancel-title" className="text-xl font-semibold">
            Cancel your {tierName} membership?
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              You keep full access until{" "}
              <span className="font-medium text-foreground">{accessUntil ?? "the end of your paid period"}</span>.
            </li>
            <li>Nothing more will be charged.</li>
            <li>Changed your mind? You can keep it any time before that date.</li>
          </ul>

          <form action={cancelMembershipAction} className="mt-6 space-y-4">
            <input type="hidden" name="subscription" value={subscriptionId} />

            <div className="space-y-1.5">
              <label htmlFor="cancel-reason" className="text-sm font-medium">
                Why are you leaving? <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <select id="cancel-reason" name="reason" defaultValue="" className={`${control} h-11`}>
                <option value="">Choose a reason</option>
                {REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cancel-comment" className="text-sm font-medium">
                Anything we could do better? <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea id="cancel-comment" name="comment" rows={3} maxLength={500} className={`${control} py-2`} />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={hide}>
                Keep my membership
              </Button>
              <SubmitButton variant="destructive" size="sm" pendingLabel="Cancelling…">
                Cancel membership
              </SubmitButton>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
