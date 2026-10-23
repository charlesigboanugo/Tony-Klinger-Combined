"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { announceSignedOut } from "@/components/navigation/useVisitor";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * Authenticated user menu — note 04 §22.
 *
 * Shows only destinations the user can reach. That is a usability decision,
 * not a security one: every route still authorizes server-side (note 04 §23).
 *
 * Same outside-click / Escape / focus-restore contract as `NavDropdown` — this
 * previously had none of it, so the menu only closed on a second click of its
 * own trigger, never on a click anywhere else on the page (note 10 §37, §21).
 *
 * Hover opens it for a mouse, like the header's `NavDropdown`s. Only for a
 * mouse: on touch, the synthetic enter would open it and the tap's click would
 * immediately toggle it shut again, so touch keeps the click toggle.
 *
 * `admin` adds the Admin link, for an account that holds a staff role (owner,
 * 2026-10-13), first in the list (owner, 2026-10-15). Like the rest of the list it only saves a click; `/admin`
 * authorizes itself.
 *
 * `backToSite` puts "Back to site" at the end of the list, before Sign out, for the workspace
 * headers (Academy, Account, Admin, Book): the way out lives here rather than
 * as a button beside the menu (owner, 2026-10-15). The public masthead omits
 * it — it is the site.
 *
 * Sign-out is a POST form invoking a Server Action, never a link. A GET-able
 * sign-out URL can be fired by any third-party image tag (note 05 §8).
 */
export function UserMenu({
  email,
  admin = false,
  backToSite = false,
  iconOnPhones = false,
}: {
  email: string;
  admin?: boolean;
  backToSite?: boolean;
  /**
   * Below `sm` the button is a round icon (owner, 2026-10-15): three bars of
   * staggered length, set apart from the workspace's left-hand menu button,
   * which is three equal bars with no outline. The menu it opens is the same.
   */
  iconOnPhones?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // How the trigger was last pressed: see its onClick.
  const pressedWith = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={(event) => {
          pressedWith.current = event.pointerType;
        }}
        onClick={() => {
          // A mouse has already opened the menu by hovering, so its click must
          // not toggle it shut again; moving away closes it. Touch and the
          // keyboard (a click with no pointer) toggle as usual.
          const mouse = pressedWith.current === "mouse";
          pressedWith.current = null;
          setOpen((v) => (mouse ? true : !v));
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-input-border px-4 py-2 text-sm font-medium transition-colors",
          iconOnPhones && "max-sm:size-10 max-sm:justify-center max-sm:px-0 tiny:size-8",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          open
            ? "border-primary bg-primary/8 text-primary"
            : "hover:border-primary hover:text-primary",
        )}
      >
        {iconOnPhones ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 tiny:size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 7h14M9 12h10M12 17h7" />
          </svg>
        ) : null}
        <span className={cn(iconOnPhones && "max-sm:sr-only")}>Account</span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn("h-2.5 w-2.5 transition-transform duration-200", iconOnPhones && "max-sm:hidden", open && "rotate-180")}
        >
          <path
            d="M2 4.5 6 8.5 10 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Kept mounted always — see NavDropdown's `dropdown-panel` comment
          (note 10 §37.1): the element must exist in both directions for the
          close to animate at all. The gap under the trigger is `pt-3` PADDING,
          not a margin, so it belongs to the panel and moving the pointer down
          onto it never leaves the container and closes the menu. */}
      <div
        id={menuId}
        role="menu"
        aria-hidden={!open}
        data-open={open}
        className="dropdown-panel absolute right-0 z-50 w-56 origin-top-right pt-3"
      >
        <div className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface p-1.5 shadow-lift">
          <p className="truncate px-3 py-2 text-xs text-muted-foreground">{email}</p>
          {[
            ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
            { href: "/account", label: "My account" },
            { href: "/academy", label: "Academy" },
            { href: "/account/orders", label: "Orders" },
            { href: "/account/bookings", label: "Bookings" },
            { href: "/account/entitlements", label: "Your access" },
            ...(backToSite ? [{ href: "/", label: "Back to site" }] : []),
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm text-foreground/90 transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <form action={signOutAction} onSubmit={announceSignedOut} className="mt-1 border-t border-border pt-1">
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-[calc(var(--radius)-2px)] px-3 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function SignedOutActions() {
  return (
    <>
      <ButtonLink href="/cart" variant="ghost" size="sm">
        Cart
      </ButtonLink>
      <ButtonLink href="/auth/sign-in" variant="outline" size="sm">
        Sign in
      </ButtonLink>
    </>
  );
}
