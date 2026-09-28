import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { REQUIRED_STAFF_FACTORS, getMfaState } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side authorization — note 06 §2, §25, §26.
 *
 * Authorization is decided here and in RLS. Never in the browser, never by
 * whether a link was rendered (note 06 §24, §27).
 *
 * These helpers are the single place permission rules are expressed, so a rule
 * cannot drift between two call sites (note 06 §26).
 */

/**
 * Whether staff must present a second factor to use their permissions.
 *
 * `true` means an `aal1` staff session is treated as holding no permissions at
 * all — which is the intent of note 06 §25.1. Enrolment lives at
 * /account/security/mfa, so an operator can always reach `aal2` themselves.
 */
export const ENFORCE_STAFF_MFA = true;

export type AuthContext = {
  userId: string;
  email: string | null;
  roles: string[];
  permissions: Set<string>;
  isStaff: boolean;
  /** Session has verified a second factor. */
  hasSecondFactor: boolean;
  /** Staff who must enrol or verify before their permissions apply. */
  mfaRequired: boolean;
  /** How many verified keys this account holds. */
  verifiedFactors: number;
  /**
   * Holds fewer keys than recommended. Prompted, not blocked — the spare key
   * prevents lockout, so withholding access until it exists would penalise the
   * operator at the moment it is meant to protect them.
   */
  needsSpareKey: boolean;
  /**
   * An owner without a spare key. Blocked from privileged actions, because
   * nobody can recover an owner account: `aal2` lives in the RLS policies, so a
   * total owner lockout means service-role SQL against production
   * (note 05 §11.1).
   */
  ownerNeedsSpareKey: boolean;
};

/**
 * Resolve the caller's identity, roles and permissions.
 *
 * Returns null when there is no session. Uses getUser(), which revalidates
 * against the Auth server — never getSession(), which trusts the cookie
 * (note 05 §12).
 *
 * Wrapped in React `cache()` so it runs ONCE per request. Without this, the
 * layout and every page and component that needs the current user each triggers
 * a fresh round trip to the Auth server plus two RPCs — which measured at 14
 * seconds for a single /account render.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: permissionRows }, { data: roleRows }] = await Promise.all([
    supabase.rpc("my_permissions"),
    supabase.rpc("my_roles"),
  ]);

  const permissions = new Set<string>(
    ((permissionRows as string[] | null) ?? []).filter(Boolean),
  );
  const roles = ((roleRows as string[] | null) ?? []).filter(Boolean);
  const isStaff = roles.length > 0;

  // Computed for EVERYONE, not just staff. It is read from the `getUser()` call
  // this request already makes (note 05 §11.1), so it costs nothing — and while
  // it cost something, a customer who had set up a key was never asked for it,
  // which made their second factor decorative.
  const mfa = await getMfaState();
  const hasSecondFactor = mfa.current === "aal2";
  const verifiedFactors = mfa.verifiedFactors;
  const isOwner = roles.includes("owner");

  return {
    userId: user.id,
    email: user.email ?? null,
    roles,
    permissions,
    isStaff,
    hasSecondFactor,
    /*
      Two different reasons to ask, one behaviour.

        staff     required whether or not they have enrolled — the role demands
                  it (note 06 §25.1), so a key-less staff session is sent to
                  enrolment.
        customer  required ONLY once they have set one up. MFA stays optional
                  for customers (note 05 §11.1); what is not optional is using
                  the key you chose to register.
    */
    mfaRequired:
      !hasSecondFactor &&
      ((isStaff && ENFORCE_STAFF_MFA) || verifiedFactors > 0),
    verifiedFactors,
    needsSpareKey: isStaff && verifiedFactors < REQUIRED_STAFF_FACTORS,
    ownerNeedsSpareKey: isOwner && verifiedFactors < REQUIRED_STAFF_FACTORS,
  };
});

/**
 * Thrown when an authenticated user lacks a permission.
 *
 * Distinct from "not signed in": note 06 §38 requires an explicit access-denied
 * response rather than pretending the route does not exist, so the two cases
 * must stay distinguishable all the way to the UI.
 */
export class AccessDeniedError extends Error {
  constructor(readonly permission?: string) {
    super(
      permission
        ? `Missing permission: ${permission}`
        : "Insufficient permissions",
    );
    this.name = "AccessDeniedError";
  }
}

/**
 * Where a staff session that has not presented its second factor should go.
 *
 * Two different problems wear the same redirect, and sending both to the
 * settings page made an ordinary sign-in look like a configuration error:
 *
 *   has keys  -> CHALLENGE. `/auth/2fa` prompts immediately, in the auth
 *                chrome, the way two-factor authentication is expected to work.
 *   no keys   -> ENROL. Only then is the settings page the right destination,
 *                because there is genuinely something to set up.
 */
function secondFactorDestination(
  context: AuthContext,
  returnTo?: string,
): string {
  if (context.verifiedFactors === 0) return "/account/security/mfa?required=1";
  const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
  return `/auth/2fa${next}`;
}

/**
 * Require a session and nothing more (note 06 §25).
 *
 * For the two pages that must stay reachable BEFORE a second factor is
 * presented — the challenge itself, and the key management page somebody with
 * no keys is sent to. Everything else should use `requireUser`, which also
 * asks for the factor.
 */
export async function requireSession(returnTo?: string): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/auth/sign-in${next}`);
  }
  return context;
}

/**
 * Require a session AND any second factor the account has set up.
 *
 * THE DEFAULT, so a page gets the gate by existing rather than by remembering.
 * The previous arrangement checked the factor only inside `requirePermission`
 * and `requireStaff`, which meant the prompt appeared when somebody navigated
 * to Admin rather than when they signed in — and never at all for a customer.
 */
export async function requireUser(returnTo?: string): Promise<AuthContext> {
  const context = await requireSession(returnTo);

  if (context.mfaRequired) {
    redirect(secondFactorDestination(context, returnTo));
  }

  return context;
}

/** True only when the permission is held AND any MFA requirement is satisfied. */
export function can(context: AuthContext, permission: string): boolean {
  if (context.mfaRequired) return false;
  return context.permissions.has(permission);
}


/**
 * Require a specific permission.
 *
 * A staff session that has not presented its second factor holds no permissions
 * (note 06 §25.1) — so this refuses before the operation, not after.
 */
export async function requirePermission(
  permission: string,
  returnTo?: string,
): Promise<AuthContext> {
  // requireUser has already asked for any second factor.
  const context = await requireUser(returnTo);

  // One key admits any staff member. An OWNER additionally needs a spare,
  // because an owner lockout cannot be resolved from inside the application.
  // The database refuses these operations too (migration 0004_operations).
  if (context.ownerNeedsSpareKey) {
    redirect(`/account/security/mfa?owner=1`);
  }

  if (!context.permissions.has(permission)) {
    throw new AccessDeniedError(permission);
  }

  return context;
}

/** Require any staff role at all — the coarse gate for the admin workspace. */
export async function requireStaff(returnTo?: string): Promise<AuthContext> {
  // Role first, so a customer who happens to hold a key is refused rather than
  // challenged and only then told they cannot be here.
  const context = await requireSession(returnTo);

  if (!context.isStaff) {
    throw new AccessDeniedError();
  }

  if (context.mfaRequired) {
    redirect(secondFactorDestination(context, returnTo));
  }

  return context;
}

/** Filter navigation by permission. Display only — never the security boundary. */
export function visibleTo<T extends { permission?: string }>(
  context: AuthContext | null,
  items: T[],
): T[] {
  if (!context) return [];
  return items.filter((item) => !item.permission || can(context, item.permission));
}
