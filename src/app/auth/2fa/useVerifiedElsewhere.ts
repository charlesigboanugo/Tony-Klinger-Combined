"use client";

import { useEffect } from "react";

import { onReturnToTab } from "@/components/navigation/useVisitor";
import { createClient } from "@/lib/supabase/client";

/**
 * Notice a second step completed in ANOTHER TAB (owner, 2026-10-24).
 *
 * The session lives in cookies shared by every tab, but a page already showing
 * "Confirm it's you" has no reason to look again: confirming in a second tab
 * left the first one stuck on its cancelled prompt until a manual refresh.
 * When the visitor returns to the tab it re-reads the session (a local read
 * of the cookie, no request) and, if it is now aal2, calls `onVerified`.
 */
export function useVerifiedElsewhere(onVerified: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let gone = false;
    const stop = onReturnToTab(() => {
      void createClient()
        .auth.mfa.getAuthenticatorAssuranceLevel()
        .then(({ data }) => {
          if (!gone && data?.currentLevel === "aal2") onVerified();
        });
    });
    return () => {
      gone = true;
      stop();
    };
  }, [enabled, onVerified]);
}
