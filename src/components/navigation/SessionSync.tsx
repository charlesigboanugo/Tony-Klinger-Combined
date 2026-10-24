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
 * `verified` (Account, Academy, Admin) adds the second step to the comparison
 * (owner, 2026-10-24): signing out and back in as the SAME person in another
 * tab left the email unchanged, so a confirmed Admin page stayed as it was
 * until a click found the new session unconfirmed. Now it re-renders on return
 * and the page's own gate sends the visitor to "Confirm it's you" at once.
 *
 * Display only. Nothing is authorized here; every request is still checked on
 * the server whatever a stale tab shows.
 */
export function SessionSync({ email, verified }: { email: string | null; verified?: boolean }) {
  const router = useRouter();

  useEffect(
    () =>
      onReturnToTab(() => {
        fetch("/api/session", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { email: string | null; verified: boolean } | null) => {
            if (!data) return;
            if (data.email !== email || (verified !== undefined && data.verified !== verified)) router.refresh();
          })
          .catch(() => {});
      }),
    [email, verified, router],
  );

  return null;
}
