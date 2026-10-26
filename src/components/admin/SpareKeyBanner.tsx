"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Icon } from "@/components/ui/Icon";

/**
 * Prompt for a second security key — note 05 §11.1.
 *
 * A prompt rather than a block. The spare key exists to prevent lockout, so
 * refusing access until it is registered would penalise the operator at exactly
 * the moment it is meant to protect them.
 *
 * It sits IN THE ADMIN HEADER as a single pill (owner, 2026-10-13). It used to
 * be a three-line panel above every admin page, which pushed each page's own
 * content down for as long as the key was missing.
 *
 * THE PILL HAS TO MAKE ITS OWN CASE (owner, 2026-10-13). A label alone reads
 * as a chore to put off, so pointing at it (or tabbing to it) opens a card
 * that says what happens if the one key is lost and what a second one changes.
 * A card rather than the browser's `title` tooltip, which appears late, cannot
 * be styled and never shows for a keyboard. Same `.dropdown-panel` motion as
 * every other menu (note 10 §37.1). On touch there is no hover, so the tap
 * goes straight to the key page.
 *
 * The owner is the exception: that account cannot be recovered by anyone else,
 * so `requirePermission()` and `assert_admin_action()` both refuse privileged
 * work until it holds two keys.
 */
export function SpareKeyBanner({
  verifiedFactors,
  isOwner,
}: {
  verifiedFactors: number;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cardId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A key or an authenticator app — either counts (2026-10-24).
  const keys = `${verifiedFactors} verification method${verifiedFactors === 1 ? "" : "s"}`;
  const label = isOwner ? "Add a second verification method to continue" : "Add a backup verification method";

  return (
    <div
      className="relative min-w-0"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {/* Phones: a round key button the size of the Account button, the
          blinking dot as its badge — the words ran out of the pill and under
          the Account button there (owner, 2026-10-26). A short label from `sm`,
          the full sentence from `md`. The label carries the sentence for screen readers at every
          size. */}
      <Link
        href="/account/security/mfa"
        aria-describedby={cardId}
        aria-label={label}
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-warning bg-warning/10 text-sm font-medium text-warning transition-colors sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5 sm:whitespace-nowrap hover:bg-warning/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* Blinks to draw the eye (owner, 2026-10-15); still for anyone who
            has asked their device for less motion. */}
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 h-2 w-2 shrink-0 rounded-full bg-warning ring-2 ring-background motion-safe:animate-[key-blink_1.4s_ease-in-out_infinite] sm:static sm:h-1.5 sm:w-1.5 sm:ring-0"
        />
        <Icon name="key" className="h-4.5 w-4.5 sm:hidden" />
        {/* The sentence needs about 290px; between sm and md the header has
            room only for the short form (it ran out of the pill at 640px). */}
        <span className="hidden sm:inline md:hidden">{isOwner ? "Add a second" : "Add a backup"}</span>
        <span className="hidden md:inline">{label}</span>
      </Link>

      {/* Kept mounted so the close animates too. The gap under the pill is
          padding, so moving the pointer down onto the card never leaves the
          container and closes it. */}
      <div
        id={cardId}
        data-open={open}
        // Phones: the chip is a dot left of the Account button, so a card
        // hung from it ran off the left of the screen (owner, 2026-10-15).
        // There it sits under the header, the screen's width less the gutter.
        className="dropdown-panel absolute right-0 z-50 w-76 max-w-[calc(100vw-2rem)] origin-top-right pt-3 max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:w-auto max-sm:max-w-none max-sm:origin-top"
      >
        <div className="rounded-(--radius-lg) border border-border bg-surface p-4 text-sm shadow-lift">
          <p className="font-semibold text-foreground">
            {isOwner ? "Why the owner needs two" : "Why add a backup?"}
          </p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {isOwner
              ? `This account has ${keys}, and nobody else can recover an owner account. If that phone or key is lost or breaks, the only way back in is direct work on the database.`
              : `You have ${keys}. If that phone or key is lost, broken or replaced, you are locked out of Admin until another administrator clears it for you.`}
          </p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {isOwner
              ? "With a second one set up, you simply use the other. Until it is, privileged actions are refused."
              : "With a second one set up, you simply sign in with the other and carry on. It takes about a minute to add."}
          </p>
          <Link
            href="/account/security/mfa"
            onClick={() => setOpen(false)}
            className="group mt-3 inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline decoration-current/40 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Add one
            <span
              aria-hidden="true"
              className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
            >
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
