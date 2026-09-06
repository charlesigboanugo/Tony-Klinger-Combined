import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Multi-factor authentication — note 05 §11.1, note 06 §25.1.
 *
 * WebAuthn only. TOTP and SMS are disabled in config: a TOTP code can be typed
 * into a convincing replica of this site, whereas a WebAuthn credential is
 * bound to the origin by the browser and cannot be replayed.
 */

/** Minimum factors a staff account must hold, so losing one is not a lockout. */
export const REQUIRED_STAFF_FACTORS = 2;

export type AalLevel = "aal1" | "aal2";

export type MfaFactor = { id: string; name: string };

export type MfaState = {
  /** What this session has actually satisfied. */
  current: AalLevel;
  /** What the account is capable of, given its enrolled factors. */
  next: AalLevel;
  verifiedFactors: number;
  /** Enrolled but never completed — these do not count towards the minimum. */
  unverifiedFactors: number;
  /**
   * The verified factors themselves, so the interface can offer to CHALLENGE
   * one. Without an id there is no way to present an existing key, which is
   * how this page came to offer enrolment as the only route to `aal2` — and
   * why every sign-in registered another redundant credential.
   */
  factors: MfaFactor[];
};

/**
 * Decode a JWT payload without verifying it.
 *
 * Safe HERE and nowhere else: it is only ever applied to the access token that
 * `getUser()` has just had validated by the Auth server on this same request.
 * If that token were forged, `getUser()` would have failed and we would not
 * reach this line. Never use it on a token that has not been checked.
 */
function claims(token: string): { aal?: string } {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

/**
 * MFA state, from the ONE `getUser()` call the request already makes.
 *
 * This used to call `getAuthenticatorAssuranceLevel()` and `listFactors()`,
 * each of which calls `getUser()` internally — three round trips to the Auth
 * server for one answer. That cost is why it was computed for staff only, and
 * that in turn is why a CUSTOMER who had set up a key was never asked for it.
 *
 * The `/user` response already carries `factors`, and the assurance level is a
 * claim in the access token, so both are free once the user is fetched. The
 * cost argument for treating customers differently is gone with it.
 */
export const getMfaState = cache(async (): Promise<MfaState> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      current: "aal1",
      next: "aal1",
      verifiedFactors: 0,
      unverifiedFactors: 0,
      factors: [],
    };
  }

  // Local read of the cookie. It is not trusted for identity — `getUser()`
  // above did that against the Auth server — only for the assurance level
  // carried in the token it just validated.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const all = user.factors ?? [];
  const verified = all.filter((f) => f.status === "verified");

  const current =
    claims(session?.access_token ?? "").aal === "aal2" ? "aal2" : "aal1";

  return {
    current,
    // What the account is CAPABLE of, which is the whole basis for asking:
    // an account with a verified factor should be presenting it.
    next: verified.length > 0 ? "aal2" : "aal1",
    verifiedFactors: verified.length,
    unverifiedFactors: all.length - verified.length,
    factors: verified.map((f, i) => ({
      id: f.id,
      name: f.friendly_name?.trim() || `Security key ${i + 1}`,
    })),
  };
});

/** True when this session has actually presented a second factor. */
export async function hasSecondFactor(): Promise<boolean> {
  return (await getMfaState()).current === "aal2";
}

/**
 * Whether a staff account is adequately protected.
 *
 * Two factors, not one. A single credential means a lost key is an account
 * recovery — and recovery is the weakest point of any MFA scheme, so the aim is
 * to need it as rarely as possible (note 06 §25.1).
 */
export async function staffMfaStatus(): Promise<
  "ok" | "needs-verification" | "needs-enrolment" | "needs-second-factor"
> {
  const state = await getMfaState();

  if (state.verifiedFactors === 0) return "needs-enrolment";
  if (state.verifiedFactors < REQUIRED_STAFF_FACTORS) return "needs-second-factor";
  if (state.current !== "aal2") return "needs-verification";
  return "ok";
}
