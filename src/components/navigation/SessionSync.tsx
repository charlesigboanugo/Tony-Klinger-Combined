"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { onReturnToTab } from "@/components/navigation/useVisitor";

/**
 * Keeps a server-rendered page honest about who is signed in — note 05 §37.3.
 *
 * Signing in or out in one tab changes the session for every tab, but a tab
 * left open keeps showing what it was rendered with. When the visitor comes
 * back to it, this asks who is signed in now, and if the answer differs from
 * `email` (who the page was rendered for) it re-renders the route. The server
 * then does what it would on a fresh load: a sign-in form sends a signed-in
 * visitor on, an account page sends a signed-out one to sign in.
 *
 * Display only. Nothing is authorized here; every request is still checked on
 * the server whatever a stale tab shows.
 */
export function SessionSync({ email }: { email: string | null }) {
  const router = useRouter();

  useEffect(
    () =>
      onReturnToTab(() => {
        fetch("/api/session", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { email: string | null } | null) => {
            if (data && data.email !== email) router.refresh();
          })
          .catch(() => {});
      }),
    [email, router],
  );

  return null;
}
