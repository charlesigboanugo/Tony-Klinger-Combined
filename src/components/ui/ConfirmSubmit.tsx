"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * A submit button that ASKS FIRST — note 10 §21.
 *
 * Owner, 2026-10-10: before an important action — registering, using a pass,
 * choosing something that cannot be changed, cancelling, deleting — the person
 * is told what they are about to do. This is that step, in one place, so every
 * such action asks in the same way and none is forgotten.
 *
 * It goes INSIDE the form it submits, where a `SubmitButton` would. Pressing
 * it opens a dialog that says what will happen, in the caller's words; only
 * "confirm" there submits the form. Everything else — the other button, Esc,
 * a click outside — closes it and changes nothing.
 *
 * A native <dialog>, so focus is trapped, Esc closes and the page behind is
 * inert without a library (the same approach as the cancel-subscription
 * dialog). It fades and scales in and out on compositor-only properties.
 */
export function ConfirmSubmit({
  children,
  title,
  points,
  note,
  confirmLabel = "Yes, go ahead",
  cancelLabel = "Not now",
  pendingLabel = "Working…",
  variant = "primary",
  size,
  className,
  disabled = false,
  destructive = false,
}: {
  /** The button's label. */
  children: ReactNode;
  /** The question: "Register for Filmmaking?" */
  title: string;
  /** What will happen, one plain line each. */
  points: ReactNode[];
  /** A quieter line under the points: what cannot be undone, or how to undo it. */
  note?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  /** The confirming button is red: something is removed or given up. */
  destructive?: boolean;
}) {
  const { pending } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const show = useCallback(() => {
    dialog.current?.showModal();
    // Next frame, so the opening state is painted before it changes.
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    // After the closing transition; at once for reduced motion.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => dialog.current?.close(), reduced ? 0 : 200);
  }, []);

  // Esc closes through the same path, so it animates out too.
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

  const confirm = () => {
    // The form this button sits in. The dialog is inside it too.
    const form = trigger.current?.form;
    hide();
    form?.requestSubmit();
  };

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending || disabled}
        aria-busy={pending}
        aria-haspopup="dialog"
        onClick={show}
      >
        {pending ? pendingLabel : children}
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        data-open={open}
        // A click on the backdrop (the dialog itself, outside the panel) closes.
        onClick={(event) => {
          if (event.target === event.currentTarget) hide();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 text-left backdrop:bg-black/0 backdrop:transition-[background-color] backdrop:duration-(--dur-base) data-[open=true]:backdrop:bg-black/50"
      >
        <div className="scale-95 rounded-(--radius-lg) border border-border bg-surface p-6 text-foreground opacity-0 shadow-lift transition-[opacity,transform] duration-200 ease-out in-data-[open=true]:scale-100 in-data-[open=true]:opacity-100 motion-reduce:transition-none sm:p-7">
          <h2 id={titleId} className="font-sans text-xl leading-snug font-semibold text-balance">
            {title}
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
            {points.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {note ? <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{note}</p> : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={hide}>
              {cancelLabel}
            </Button>
            <Button type="button" variant={destructive ? "destructive" : "primary"} size="sm" onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
