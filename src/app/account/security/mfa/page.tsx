import type { Metadata } from "next";

import { EnrolWebAuthn } from "@/app/account/security/mfa/EnrolWebAuthn";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { REQUIRED_STAFF_FACTORS, getMfaState } from "@/lib/auth/mfa";
import { publicEnv } from "@/lib/env/public";
import { requireSession } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Security keys",
  robots: { index: false },
};

/**
 * Security keys — note 05 §11.1, note 06 §25.1.
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

  const context = await requireSession("/account/security/mfa");
  const mfa = await getMfaState();

  const site = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
  const remaining = REQUIRED_STAFF_FACTORS - mfa.verifiedFactors;

  const hasKeys = mfa.verifiedFactors > 0;
  const verified = mfa.current === "aal2";
  const needsVerification = hasKeys && !verified;

  /*
    NO Section/Container of its own. This page renders inside the account
    layout, which already provides the container and the column — wrapping
    again indented the heading 64px and dropped it 64px, so it no longer lined
    up with the sidebar the way every sibling page does.
  */
  return (
    <>
      <PageHeader
        title="Security keys"
        description={
          context.isStaff
            ? "Staff accounts are protected with security keys rather than codes."
            : "Add a security key for stronger protection. Optional for customers."
        }
      />

      {/* Only shown when the operator still has something to do. Repeating
            "you need a key" after they have just used one is noise. */}
      {required && !verified ? (
        <div className="mb-6">
          <FormMessage>
            {hasKeys
              ? "Confirm it's you with your security key to continue."
              : "This account can manage the platform, so it needs a security key before you can continue."}
          </FormMessage>
        </div>
      ) : null}

      {ownerBlocked ? (
        <div className="mb-6">
          <FormMessage>
            Owner accounts need two registered keys before performing privileged
            actions. Nobody else can recover an owner account, so a single key
            is a single point of failure.
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
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              You have {mfa.verifiedFactors} key
              {mfa.verifiedFactors === 1 ? "" : "s"} registered. Use one to
              unlock this session — you are not creating a new key.
            </p>
            <ButtonLink href="/auth/2fa?next=/account/security" size="lg">
              Unlock with your security key
            </ButtonLink>
          </div>
        ) : null}

        <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Registered keys</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {mfa.verifiedFactors}
              </p>
            </div>
            {verified ? (
              <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                This session is verified
              </span>
            ) : null}
          </div>

          {mfa.factors.length > 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              {mfa.factors.map((factor) => (
                <li key={factor.id} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-success">
                    &#10003;
                  </span>
                  <span>{factor.name}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {context.isStaff ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {remaining > 0
                ? `${remaining} more recommended. Two keys means losing one is an inconvenience rather than a lockout.`
                : "Requirement met."}
            </p>
          ) : null}
        </div>

        {/* Enrolment is secondary once a key exists — it adds a spare, it is
              not how you get in. */}
        <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold">
            {hasKeys ? "Add another key" : "Register a security key"}
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {hasKeys
              ? "A spare key on a different device means losing one is an inconvenience rather than a lockout."
              : "A key on this device, or a hardware key such as a YubiKey."}
          </p>
          <EnrolWebAuthn
            rpId={site.hostname}
            origin={site.origin}
            // So the default name cannot collide with one already taken,
            // which is what produced the 422 on every second enrolment.
            existingNames={mfa.factors.map((f) => f.name)}
          />
        </div>

        {context.isStaff && hasKeys ? (
          <p className="text-sm text-muted-foreground">
            Lost every key? Recovery is performed by another administrator and
            is recorded in the audit log — there is deliberately no self-service
            reset, since that would make the security key only as strong as your
            email account.
          </p>
        ) : null}
      </div>
    </>
  );
}
