"use client";

import { useEffect, useState } from "react";

export type Visitor = {
  email: string | null;
  /** Holds a staff role, so the account menu offers Admin. Display only. */
  admin: boolean;
  cartCount: number;
  cartSlugs: string[];
};

/** Fired after anything that changes the cart or who is signed in. */
export const VISITOR_CHANGED = "tk:visitor-changed";

export function announceVisitorChange() {
  window.dispatchEvent(new Event(VISITOR_CHANGED));
}

/**
 * True from this tab's own sign-out until the server next answers. The page is
 * already being replaced by the sign-out itself, so nothing should re-render
 * it on top (see `PublicHeader`).
 */
let signingOutHere = false;

export function isSigningOutHere() {
  return signingOutHere;
}

/**
 * Sign-out clears the account at once rather than re-asking: the request would
 * race the server clearing the cookie and could bring the old email back.
 */
export function announceSignedOut() {
  signingOutHere = true;
  window.dispatchEvent(new CustomEvent(VISITOR_CHANGED, { detail: { signedOut: true } }));
}

/**
 * Run `callback` each time the visitor comes back to this tab.
 *
 * Three events, because no one of them covers every way back: `focus` misses
 * a tab switch made while the address bar holds the cursor, `visibilitychange`
 * misses a return from another window that never hid the tab, and `pageshow`
 * is the only one fired when Back restores a page from the browser's cache.
 * They often arrive together, so calls within a second of each other count
 * once.
 */
export function onReturnToTab(callback: () => void): () => void {
  let last = 0;
  const run = () => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - last < 1000) return;
    last = now;
    callback();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) run();
  };
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", run);
  window.addEventListener("pageshow", onPageShow);
  return () => {
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", run);
    window.removeEventListener("pageshow", onPageShow);
  };
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
        setVisitor((v) => (v ? { ...v, email: null, admin: false } : v));
      } else {
        bump();
      }
    };
    window.addEventListener(VISITOR_CHANGED, onChange);
    const stop = onReturnToTab(bump);
    return () => {
      window.removeEventListener(VISITOR_CHANGED, onChange);
      stop();
    };
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Visitor | null) => {
        signingOutHere = false;
        if (live && data) setVisitor(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname, version]);

  return visitor;
}
