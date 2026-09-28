import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils/device";
import type { Database } from "@/types/database";

type Fns = Database["public"]["Functions"];

/**
 * Multi-factor authentication — note 05 §11.1, note 06 §25.1.
 *
 * WebAuthn only. TOTP and SMS are disabled in config: a TOTP code can be typed
 * into a convincing replica of this site, whereas a WebAuthn credential is
 * bound to the origin by the browser and cannot be replayed.
 */

/** Minimum factors a staff account must hold, so losing one is not a lockout. */
export const REQUIRED_STAFF_FACTORS = 2;

/**
 * How recently a key must have been used on this session before a key can be
 * REMOVED. Mirrors the database gate (migration 0022), which is what enforces
 * it; this copy only decides whether to ask for a key before offering Remove.
 */
export const KEY_RECONFIRM_MINUTES = 10;

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
  /** This session presented a key within KEY_RECONFIRM_MINUTES. */
  keyRecentlyConfirmed: boolean;
};

/**
 * Decode a JWT payload without verifying it.
 *
 * Safe HERE and nowhere else: it is only ever applied to the access token that
 * `getUser()` has just had validated by the Auth server on this same request.
 * If that token were forged, `getUser()` would have failed and we would not
 * reach this line. Never use it on a token that has not been checked.
 */
function claims(token: string): {
  aal?: string;
  amr?: Array<{ method?: string; timestamp?: number }>;
} {
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
      keyRecentlyConfirmed: false,
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

  const token = claims(session?.access_token ?? "");
  const current = token.aal === "aal2" ? "aal2" : "aal1";
  const keyUse = token.amr?.find((m) => m.method === "mfa/webauthn")?.timestamp;

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
    // The clock is read here, with the data, not in a component's render.
    keyRecentlyConfirmed:
      current === "aal2" && keyUse !== undefined && Date.now() - keyUse * 1000 < KEY_RECONFIRM_MINUTES * 60_000,
  };
});

export type SecurityKey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** "3 days ago", or null if never used to sign in. */
  lastUsedAgo: string | null;
  aaguid: string | null;
};

/** The caller's own keys, with model id and last use — migration 0022. */
export async function mySecurityKeys(): Promise<SecurityKey[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_security_keys");
  const rows = (data ?? []) as Fns["my_security_keys"]["Returns"];
  const now = Date.now();
  return rows.map((k, i) => ({
    id: k.id,
    name: k.name?.trim() || `Security key ${i + 1}`,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at ?? null,
    lastUsedAgo: timeAgo(k.last_used_at, now),
    aaguid: k.aaguid ?? null,
  }));
}

export type SignedInSession = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  lastActiveAgo: string | null;
  userAgent: string | null;
  ip: string | null;
  verifiedWithKey: boolean;
  current: boolean;
};

/** The caller's own signed-in sessions, this one first — migration 0022. */
export async function mySessions(): Promise<SignedInSession[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_sessions");
  const rows = (data ?? []) as Fns["my_sessions"]["Returns"];
  const now = Date.now();
  return rows.map((s) => ({
    id: s.id,
    createdAt: s.created_at,
    lastActiveAt: s.last_active_at,
    lastActiveAgo: timeAgo(s.last_active_at, now),
    userAgent: s.user_agent ?? null,
    // A private or loopback address is the server or a proxy, not the visitor.
    ip: s.ip && !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i.test(s.ip) ? s.ip : null,
    verifiedWithKey: s.aal === "aal2",
    current: s.is_current,
  }));
}

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
