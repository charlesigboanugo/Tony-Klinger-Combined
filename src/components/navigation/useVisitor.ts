"use client";

import { useEffect, useState } from "react";

export type Visitor = { email: string | null; cartCount: number };

/** Fired after anything that changes the cart or who is signed in. */
export const VISITOR_CHANGED = "tk:visitor-changed";

export function announceVisitorChange() {
  window.dispatchEvent(new Event(VISITOR_CHANGED));
}

/**
 * Sign-out clears the account at once rather than re-asking: the request would
 * race the server clearing the cookie and could bring the old email back.
 */
export function announceSignedOut() {
  window.dispatchEvent(new CustomEvent(VISITOR_CHANGED, { detail: { signedOut: true } }));
}

/**
 * The signed-in email and cart count, fetched after the page loads so the page
 * itself can be pre-built. `null` until known, so the header can hold its
 * space rather than flash "Sign in" at a signed-in visitor.
 */
export function useVisitor(pathname: string): Visitor | null {
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const onChange = (event: Event) => {
      if ((event as CustomEvent<{ signedOut?: boolean }>).detail?.signedOut) {
        setVisitor((v) => (v ? { ...v, email: null } : v));
      } else {
        bump();
      }
    };
    window.addEventListener(VISITOR_CHANGED, onChange);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener(VISITOR_CHANGED, onChange);
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Visitor | null) => {
        if (live && data) setVisitor(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname, version]);

  return visitor;
}
