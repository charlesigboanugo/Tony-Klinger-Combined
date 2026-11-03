"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { signOutAction } from "@/app/auth/actions";
import { finishProgress, startProgress } from "@/components/navigation/NavigationProgress";
import { announceSignedOut } from "@/components/navigation/useVisitor";

/**
 * Signing out, with the feedback a click on a link gets (owner, 2026-11-03:
 * the page "just appears to hang until it signs out"). The top progress bar
 * runs and the button says so while the server signs out; then the bar ends,
 * on the new page or, where the page stays put, here.
 *
 * A POST form, never a link, so no other page can sign someone out (note 05
 * §8). The button is the caller's, drawn from `pending`, so the desktop menu
 * item and the phone menu button keep their own looks.
 */
export function SignOutForm({
  className,
  onDone,
  children,
}: {
  className?: string;
  /** After signing out, where the page did not change: the phone menu closes. */
  onDone?: () => void;
  children: (pending: boolean) => ReactNode;
}) {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        announceSignedOut();
        startProgress();
      }}
      className={className}
    >
      <Status onDone={onDone}>{children}</Status>
    </form>
  );
}

function Status({ onDone, children }: { onDone?: () => void; children: (pending: boolean) => ReactNode }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (pending) was.current = true;
    else if (was.current) {
      was.current = false;
      finishProgress();
      onDone?.();
    }
  }, [pending, onDone]);
  return children(pending);
}
