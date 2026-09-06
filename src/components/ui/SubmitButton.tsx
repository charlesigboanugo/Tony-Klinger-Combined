"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonVariant } from "@/components/ui/Button";

/**
 * Submit button that reflects pending state — note 10 §21, §22.
 *
 * Disabled while submitting so a double click cannot fire the action twice.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  variant = "primary",
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
  /** Blocked for a reason of the caller's own, beyond "currently submitting". */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
