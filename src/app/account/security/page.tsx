import type { Metadata } from "next";
import Link from "next/link";

import { PasswordForm } from "@/app/account/security/PasswordForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { REQUIRED_STAFF_FACTORS, getMfaState } from "@/lib/auth/mfa";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Security", robots: { index: false } };

/**
 * Security overview — note 03 §24, note 05 §11.1.
 *
 * Built the way a security page is expected to work: a list of the protections
 * on the account, each showing its CURRENT STATE and one action. Someone opens
 * this page to answer "what is protecting my account, and what still needs
 * doing?" — so every row answers both, and nothing requires opening a
 * sub-page to find out.
 *
 * State is shown as a labelled pill AND in words. Colour alone would leave the
 * status unreadable to anyone who cannot separate green from amber (note 10
 * §21).
 */
function StatusRow({
  title,
  description,
  state,
  detail,
  actionLabel,
  actionHref,
  children,
}: {
  title: string;
  description: string;
  state: "on" | "attention" | "off";
  detail: string;
  actionLabel?: string;
  actionHref?: string;
  children?: React.ReactNode;
}) {
  const pill = {
    on: { text: "Active", cls: "border-success/40 bg-success/10 text-success" },
    attention: {
      text: "Needs attention",
      cls: "border-warning/40 bg-warning/10 text-warning",
    },
    off: { text: "Not set up", cls: "border-border bg-surface-muted text-muted-foreground" },
  }[state];

  return (
    <section className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
            pill.cls,
          )}
        >
          {pill.text}
        </span>
      </div>

      <p className="mt-4 border-t border-border pt-4 text-sm">{detail}</p>

      {children}

      {actionHref && actionLabel ? (
        <p className="mt-4">
          <Link
            href={actionHref}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {actionLabel} &rarr;
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export default async function SecurityPage() {
  const context = await requireUser("/account/security");
  const mfa = await getMfaState();

  const keys = mfa.verifiedFactors;
  const shortOfSpare = context.isStaff && keys < REQUIRED_STAFF_FACTORS;

  return (
    <>
      <PageHeader
        title="Security"
        description="What is protecting this account, and anything still to set up."
      />

      <div className="space-y-4">
        <StatusRow
          title="Security keys"
          description="A key on your device or a hardware key, instead of a code."
          state={keys === 0 ? "off" : shortOfSpare ? "attention" : "on"}
          detail={
            keys === 0
              ? context.isStaff
                ? "No keys registered. Staff accounts need one before reaching the admin area."
                : "No keys registered. Optional for customers, but stronger than a password alone."
              : shortOfSpare
                ? `${keys} key registered. A spare on a second device means losing one is an inconvenience rather than a lockout.`
                : `${keys} keys registered.`
          }
          actionLabel={keys === 0 ? "Set up a security key" : "Manage security keys"}
          actionHref="/account/security/mfa"
        >
          {mfa.factors.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
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

          {/* Whether THIS session has actually presented a key is different
              from whether the account has one, and staff are gated on the
              former — so it is stated separately rather than implied. */}
          {context.isStaff && keys > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This session is{" "}
              <span
                className={
                  mfa.current === "aal2"
                    ? "font-medium text-success"
                    : "font-medium text-warning"
                }
              >
                {mfa.current === "aal2" ? "verified" : "not yet verified"}
              </span>
              {mfa.current === "aal2"
                ? "."
                : " — you will be asked for your key when you open the admin area."}
            </p>
          ) : null}
        </StatusRow>

        <StatusRow
          title="Password"
          description="Used with your email address to sign in."
          state="on"
          detail="Set. Choose one you do not use on any other site — change it below."
        >
          <div className="mt-4 max-w-md">
            <PasswordForm />
          </div>
        </StatusRow>

        <StatusRow
          title="Email address"
          description="Where sign-in links and receipts are sent."
          state="on"
          detail={context.email ?? "Signed in."}
          actionLabel="Update your details"
          actionHref="/account/profile"
        />
      </div>

      {context.isStaff ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Lost every key? Recovery is performed by another administrator and is
          recorded in the audit log. There is deliberately no self-service
          reset, since that would make a security key only as strong as the
          email account behind it.
        </p>
      ) : null}
    </>
  );
}
