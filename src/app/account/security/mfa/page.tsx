import type { Metadata } from "next";

import { EnrolTotp } from "@/app/account/security/mfa/EnrolTotp";
import { EnrolWebAuthn } from "@/app/account/security/mfa/EnrolWebAuthn";
import { RefreshWhenVerified } from "@/app/account/security/mfa/RefreshWhenVerified";
import { RemoveKey } from "@/app/account/security/mfa/RemoveKey";
import { AccountHeader } from "@/components/account/AccountHeader";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import {
  KEY_RECONFIRM_MINUTES,
  REQUIRED_STAFF_FACTORS,
  SECURITY_KEYS_ENABLED,
  getMfaState,
  mySecurityKeys,
} from "@/lib/auth/mfa";
import { publicEnv } from "@/lib/env/public";
import { requireSession } from "@/lib/permissions";
import { describeAuthenticator } from "@/lib/utils/device";

export const metadata: Metadata = {
  title: "Two-step verification",
  robots: { index: false },
};

/**
 * Two-step verification: security keys and authenticator apps — note 05
 * §11.1, note 06 §25.1. The route keeps its old name; links point at it.
 *
 * An authenticator app is always offered; a key only where SECURITY_KEYS=on
 * (hosted Supabase refuses WebAuthn MFA, 2026-10-24). Either counts towards
 * the staff minimum and either unlocks the session.
 *
 * THE PAGE HAS TWO JOBS AND USED TO OFFER ONLY ONE.
 *
 *   verify  present a key you already hold, to raise this session to aal2
 *   enrol   register a new key
 *
 * Only enrolment existed. Since registering a key also verifies it, the gate
 * appeared to pass — but the operator was being asked to create a NEW
 * credential on every sign-in, accumulating redundant keys, when what the
 * session actually needed was a challenge against an existing one.
 *
 * So the branch below is by SESSION STATE, not by key count:
 *
 *   no keys at all        -> enrol (the only thing possible)
 *   keys, session aal1    -> VERIFY. Enrolling another is secondary.
 *   keys, session aal2    -> manage; prompt for a spare if short
 *
 * The spare-key prompt never blocks a non-owner (note 05 §11.1): a second key
 * is lockout insurance, and refusing entry until one exists would penalise the
 * operator at exactly the moment the policy is meant to protect them.
 */
export default async function MfaPage({
  searchParams,
}: PageProps<"/account/security/mfa">) {
  const params = await searchParams;
  const required = params.required === "1";
  const ownerBlocked = params.owner === "1";
  const removed = typeof params.removed === "string" ? params.removed : null;

  const context = await requireSession("/account/security/mfa");
  const [mfa, keys] = await Promise.all([getMfaState(), mySecurityKeys()]);

  const site = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
  // Keys where keys are switched off can't be used, so they don't count
  // towards the recommended two (the database's minimum still counts them).
  const usableCount = keys.filter((k) => k.kind === "app" || SECURITY_KEYS_ENABLED).length;
  const remaining = REQUIRED_STAFF_FACTORS - usableCount;

  const hasKeys = mfa.verifiedFactors > 0;
  const verified = mfa.current === "aal2";
  const needsVerification = hasKeys && !verified;
  // A key where keys are switched off can't be challenged (Supabase refuses).
  const usable = mfa.factors.filter((f) => f.kind === "app" || SECURITY_KEYS_ENABLED).length;

  // The same minimum the database enforces on removal (migration 0022):
  // an owner keeps two, other staff one, customers none.
  const minimum = context.roles.includes("owner") ? 2 : context.isStaff ? 1 : 0;
  const atMinimum = keys.length <= minimum;
  const recentlyConfirmed = mfa.keyRecentlyConfirmed;

  /*
    NO Section/Container of its own. This page renders inside the account
    layout, which already provides the container and the column — wrapping
    again indented the heading 64px and dropped it 64px, so it no longer lined
    up with the sidebar the way every sibling page does.
  */
  /*
    The way back (note 04 §32.3). Normally to Security, which links here. An
    owner sent here from Admin goes back there. A staff account held at the
    gate (`required`, no verified session yet) gets no button: every other
    account page would only send it straight back, and the header's "Back to
    site" is the honest exit.
  */
  const back = ownerBlocked
    ? { href: "/admin", label: "Admin" }
    : required && !verified
      ? null
      : { href: "/account/security", label: "Security" };

  return (
    <>
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
      {verified ? null : <RefreshWhenVerified />}

      <AccountHeader
        title="Two-step verification"
        description={
          context.isStaff
            ? "Staff accounts confirm it's them with a second step after the password."
            : "A second step after your password, for stronger protection. Optional for customers."
        }
      />

      {removed ? (
        <div className="mb-6">
          <FormMessage tone="success">
            {removed === "key" ? "That verification method" : `“${removed}”`} was removed. We&apos;ve emailed you to confirm.
          </FormMessage>
        </div>
      ) : null}

      {/* Only shown when the operator still has something to do. Repeating
            "you need a key" after they have just used one is noise. */}
      {required && !verified ? (
        <div className="mb-6">
          <FormMessage>
            {hasKeys
              ? "Confirm it's you to continue."
              : `This account can manage the platform, so it needs two-step verification before you can continue — ${
                  SECURITY_KEYS_ENABLED ? "a security key, or an authenticator app on your phone" : "an authenticator app on your phone"
                }.`}
          </FormMessage>
        </div>
      ) : null}

      {ownerBlocked ? (
        <div className="mb-6">
          <FormMessage>
            Owner accounts need two verification methods set up before performing
            privileged actions. Nobody else can recover an owner account, so a
            single one is a single point of failure.
          </FormMessage>
        </div>
      ) : null}

      <div className="space-y-6">
        {/* PRIMARY ACTION when keys exist but this session has not used one.
              The challenge itself lives at /auth/2fa so there is ONE
              implementation of it: this page held a second, weaker copy that
              could only ever offer the first key. */}
        {needsVerification ? (
          <div className="rounded-(--radius-lg) border border-primary/40 bg-surface p-5 shadow-card ring-1 ring-primary/20">
            <h2 className="font-display text-lg font-semibold">
              Confirm it&apos;s you
            </h2>
            {usable > 0 ? (
              <>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  You have {mfa.verifiedFactors} verification method{mfa.verifiedFactors === 1 ? "" : "s"} set up. Use one
                  to unlock this session — you are not adding a new one.
                </p>
                <ButtonLink href="/auth/2fa?next=/account/security" size="lg">
                  Confirm it&apos;s you
                </ButtonLink>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Your security key can&apos;t be used on this site.{" "}
                {context.isStaff
                  ? "Ask another administrator to clear it, then set up an authenticator app."
                  : "Ask us to remove it, then set up an authenticator app."}
              </p>
            )}
          </div>
        ) : null}

        <section
          aria-labelledby="your-keys"
          className="rounded-(--radius-lg) border border-border bg-surface shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id="your-keys" className="text-lg">
              Your verification methods <span className="text-sm font-normal text-muted-foreground">({keys.length})</span>
            </h2>
            {verified ? (
              <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                This session is verified
              </span>
            ) : null}
          </div>

          {keys.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nothing set up yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {keys.map((key) => {
                const where =
                  key.kind === "app"
                    ? key.name.startsWith("Authenticator app") ? null : "Authenticator app"
                    : describeAuthenticator(key.aaguid);
                const used = key.lastUsedAgo;
                return (
                  <li key={key.id} className="flex items-start gap-4 px-5 py-4">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-muted-foreground"
                    >
                      <Icon name={key.kind === "app" ? "phone" : "key"} className="h-5 w-5" />
                    </span>
                    {/* Details and the action share the column beside the icon,
                        so on a phone the action wraps under the TEXT, not the
                        icon (owner, 2026-10-26). */}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="font-medium break-words">{key.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {where ? `${where} · ` : ""}
                          Added{" "}
                          {new Date(key.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
                          })}
                          {" · "}
                          {used ? `last used ${used}` : "not used to sign in yet"}
                          {key.kind === "key" && !SECURITY_KEYS_ENABLED ? " · security keys can't be used on this site" : ""}
                        </p>
                      </div>
                      {/* Nothing to remove with until this session is confirmed: the
                          database would refuse it, so the button isn't offered. */}
                      {needsVerification ? null : atMinimum && minimum > 0 ? (
                        <span className="text-xs text-muted-foreground">Required — add another to remove</span>
                      ) : (
                        <RemoveKey factorId={key.id} name={key.name} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {keys.length > 0 && !needsVerification && !recentlyConfirmed && !atMinimum ? (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              Removing one asks you to confirm it&apos;s you first, if you haven&apos;t in the last{" "}
              {KEY_RECONFIRM_MINUTES} minutes.
            </p>
          ) : null}

          {context.isStaff ? (
            <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
              {remaining > 0
                ? `${remaining} more recommended. Two methods means losing one is an inconvenience rather than a lockout.`
                : "Requirement met."}
            </p>
          ) : null}
        </section>

        {/* Enrolment is secondary once one exists — it adds a spare, it is
              not how you get in. Supabase refuses a new one from an unverified
              session, so neither is offered until this session is confirmed. */}
        {needsVerification ? null : (
          <>
            {SECURITY_KEYS_ENABLED ? (
              <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
                <h2 className="font-display text-lg font-semibold">
                  {hasKeys ? "Add a security key" : "Register a security key"}
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  The strongest option: a key on this device, or a hardware key such as a YubiKey. Nothing to type,
                  so nothing a fake site can catch.
                </p>
                <EnrolWebAuthn
                  rpId={site.hostname}
                  origin={site.origin}
                  // So the default name cannot collide with one already taken,
                  // which is what produced the 422 on every second enrolment.
                  existingNames={mfa.factors.map((f) => f.name)}
                />
              </div>
            ) : null}

            <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-semibold">
                {hasKeys ? "Add an authenticator app" : "Set up an authenticator app"}
              </h2>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">
                A free app on your phone shows a new 6-digit code every 30 seconds; you type it after your password.
                Only ever type it on this site.
              </p>
              <EnrolTotp existingNames={mfa.factors.map((f) => f.name)} />
            </div>
          </>
        )}

        {context.isStaff && hasKeys ? (
          <p className="text-sm text-muted-foreground">
            Lost your phone or key? Recovery is performed by another administrator
            and is recorded in the audit log — there is deliberately no
            self-service reset, since that would make the second step only as
            strong as your email account.
          </p>
        ) : null}
      </div>
    </>
  );
}
