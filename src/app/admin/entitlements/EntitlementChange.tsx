"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";

import { adjustEntitlementAction, revokeEntitlementAction, type AdminState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: AdminState = {};

export type ChangeableEntitlement = {
  id: string;
  resource_type: string;
  source_type: string;
  source_id?: string | null;
  status: string;
  quantity: number | null;
  quantity_used: number;
  expires_at: string | null;
};

/** What comes with a Coaching Pass: re-derived from the pass, so not changed on its own. */
const comesWithPass = (e: ChangeableEntitlement) => e.source_type === "membership" && e.resource_type !== "membership";

/**
 * Revoke or adjust one entitlement — note 06 §23.1.
 *
 * The last cell of an access row: a "Change" button opening a dialog with what
 * this person's role may do. Adjust (`entitlements.adjust`) opens on the
 * current number of sessions and end date. Revoke (`entitlements.revoke`)
 * ends the access now and asks first, through `ConfirmSubmit`. Both need a
 * reason, which goes to the audit log; the actions check permission and the
 * row again on submit.
 *
 * Nothing is offered for access that has ended, or that comes with a pass
 * (the pass is what to change). A native <dialog>, animated in and out the
 * same way as `ConfirmSubmit`.
 */
export function EntitlementChange({
  entitlement: e,
  what,
  person,
  canAdjust,
  canRevoke,
}: {
  entitlement: ChangeableEntitlement;
  /** What the access is to, as staff would say it. */
  what: string;
  person: string;
  canAdjust: boolean;
  canRevoke: boolean;
}) {
  const [adjustState, adjust] = useActionState(adjustEntitlementAction, initialState);
  const [revokeState, revoke] = useActionState(revokeEntitlementAction, initialState);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const show = useCallback(() => {
    dialog.current?.showModal();
    requestAnimationFrame(() => setOpen(true));
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => dialog.current?.close(), reduced ? 0 : 200);
  }, []);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      hide();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [hide]);

  if (comesWithPass(e)) {
    return <span className="text-xs whitespace-nowrap text-muted-foreground">With their pass</span>;
  }
  const mayAdjust = canAdjust && (e.status === "active" || e.status === "consumed");
  const mayRevoke = canRevoke && e.status === "active";
  if (!mayAdjust && !mayRevoke) return null;

  // The end date as the UK calendar shows it, for the date picker.
  const endsOn = e.expires_at ? new Date(e.expires_at).toLocaleDateString("en-CA", { timeZone: "Europe/London" }) : "";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const isPass = e.resource_type === "membership";
  // A pass paid by subscription: the next payment would give it back.
  const bySubscription = isPass && e.source_type === "membership";

  return (
    <>
      <Button variant="outline" size="sm" aria-haspopup="dialog" onClick={show}>
        Change
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        data-open={open}
        onClick={(event) => {
          if (event.target === event.currentTarget) hide();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg bg-transparent p-0 text-left backdrop:bg-black/0 backdrop:transition-[background-color] backdrop:duration-(--dur-base) data-[open=true]:backdrop:bg-black/50"
      >
        <div className="scale-95 rounded-(--radius-lg) border border-border bg-surface p-6 text-foreground opacity-0 shadow-lift transition-[opacity,transform] duration-200 ease-out in-data-[open=true]:scale-100 in-data-[open=true]:opacity-100 motion-reduce:transition-none sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="font-sans text-xl leading-snug font-semibold text-balance">
                {what}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{person}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={hide}>
              Close
            </Button>
          </div>

          {mayAdjust ? (
            <form action={adjust} className="mt-6 space-y-4">
              <input type="hidden" name="entitlementId" value={e.id} />
              <h3 className="text-sm font-semibold">Adjust</h3>
              {adjustState.error ? <FormMessage>{adjustState.error}</FormMessage> : null}
              {adjustState.success ? <FormMessage tone="success">{adjustState.success}</FormMessage> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                {e.quantity != null ? (
                  <Field
                    label="Sessions in total"
                    name="quantity"
                    hint={`${e.quantity_used} used so far.`}
                  >
                    <Input
                      name="quantity"
                      type="number"
                      min={Math.max(1, e.quantity_used)}
                      defaultValue={e.quantity}
                      required
                    />
                  </Field>
                ) : null}
                <Field
                  label="Ends"
                  name="expiresAt"
                  hint={endsOn ? "An end date can be moved, not removed." : "No end date now. Pick one to set it."}
                >
                  <Input name="expiresAt" type="date" min={today} defaultValue={endsOn} />
                </Field>
              </div>
              <Field label="Reason" name="reason" hint="Filled in for you; change it if you like. Recorded in the audit log.">
                <Input name="reason" required defaultValue="Access adjusted from Admin" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton size="sm" pendingLabel="Saving…">
                  Save changes
                </SubmitButton>
              </div>
            </form>
          ) : null}

          {mayRevoke ? (
            <form action={revoke} className={mayAdjust ? "mt-6 space-y-4 border-t border-border pt-6" : "mt-6 space-y-4"}>
              <input type="hidden" name="entitlementId" value={e.id} />
              <h3 className="text-sm font-semibold">Revoke</h3>
              <p className="text-sm text-muted-foreground">Ends this access now. The record is kept, marked revoked.</p>
              {revokeState.error ? <FormMessage>{revokeState.error}</FormMessage> : null}
              <Field label="Reason" name="reason" hint="Filled in for you; change it if you like. Recorded in the audit log.">
                <Input name="reason" required defaultValue="Access revoked from Admin" />
              </Field>
              <div className="flex justify-end">
                <ConfirmSubmit
                  variant="destructive"
                  destructive
                  size="sm"
                  pendingLabel="Revoking…"
                  title={`Revoke ${what}?`}
                  points={[
                    `${person} loses access to ${what} straight away.`,
                    ...(isPass ? ["The series, playlists and retreats that come with the pass end with it."] : []),
                    "Bookings already made with it stay as they are. Cancel them under Bookings if they should go too.",
                    "The revoke and your reason are kept in the audit log.",
                  ]}
                  note={
                    bySubscription
                      ? "They pay for this pass by subscription. Cancel the subscription too, or their next payment gives the pass back."
                      : "This cannot be undone. To give the access back, grant it again."
                  }
                  confirmLabel="Yes, revoke it"
                  cancelLabel="Keep it"
                >
                  Revoke access
                </ConfirmSubmit>
              </div>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
