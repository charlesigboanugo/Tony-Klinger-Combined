import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PasswordForm } from "@/app/account/security/PasswordForm";
import { signOutOtherSessionsAction, signOutSessionAction } from "@/app/account/security/actions";
import { AccountHeader } from "@/components/account/AccountHeader";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile, type IconName, type IconTone } from "@/components/ui/Icon";
import { REQUIRED_STAFF_FACTORS, getMfaState, mySecurityKeys, mySessions } from "@/lib/auth/mfa";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";
import { describeAuthenticator, describeDevice } from "@/lib/utils/device";

export const metadata: Metadata = { title: "Security", robots: { index: false } };

/**
 * Security overview — note 03 §24, note 05 §11.1, §11.2.
 *
 * A list of the protections on the account, each a card led by its icon,
 * showing its CURRENT STATE and one action. Someone opens this page to answer
 * "what is protecting my account, and what still needs doing?" — so every card
 * answers both without opening a sub-page.
 *
 * State is a labelled pill AND words; colour alone would leave it unreadable to
 * anyone who cannot separate green from amber (note 10 §21).
 */
type State = "on" | "attention" | "off" | "info";

const PILL: Record<State, { text: string; cls: string } | null> = {
  on: { text: "Active", cls: "border-success/40 bg-success/10 text-success" },
  attention: { text: "Needs attention", cls: "border-warning/40 bg-warning/10 text-warning" },
  off: { text: "Not set up", cls: "border-border bg-surface-muted text-muted-foreground" },
  info: null,
};

const TILE: Record<State, IconTone> = {
  on: "success",
  attention: "warning",
  off: "neutral",
  info: "neutral",
};

function SecurityCard({
  id,
  icon,
  title,
  description,
  state,
  headerAction,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  state: State;
  headerAction?: ReactNode;
  children?: ReactNode;
}) {
  const pill = PILL[state];
  return (
    <section
      aria-labelledby={id}
      className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      {/* Everything under the heading starts where the heading's TEXT
          starts, never under the icon (owner, 2026-09-27): the tile sits
          beside the title from sm with the body indented to match, and
          above it on phones, where there is no room to indent. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
        <IconTile name={icon} tone={TILE[state]} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-lg">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {headerAction ??
          (pill ? (
            <span className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", pill.cls)}>
              {pill.text}
            </span>
          ) : null)}
      </div>
      {children ? <div className="mt-5 sm:pl-16">{children}</div> : null}
    </section>
  );
}

/** A row inside a card: leading tile, two lines, optional trailing control. */
function ItemRow({
  icon,
  tone = "neutral",
  title,
  badge,
  meta,
  trailing,
}: {
  icon: IconName;
  tone?: IconTone;
  title: string;
  badge?: ReactNode;
  meta: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <IconTile name={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          {/* Wraps rather than truncates: "Windows 11 computer" cut to
              "Windows compu…" beside a Sign out button on a phone. */}
          <span className="break-words">{title}</span>
          {badge}
        </p>
        <p className="text-sm text-muted-foreground">{meta}</p>
      </div>
      {trailing ? <div className="w-full pl-14 sm:w-auto sm:pl-0">{trailing}</div> : null}
    </li>
  );
}

const ukDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

export default async function SecurityPage() {
  const context = await requireUser("/account/security");
  const [mfa, keys, sessions] = await Promise.all([getMfaState(), mySecurityKeys(), mySessions()]);
  const others = sessions.filter((s) => !s.current).length;

  const count = keys.length;
  const shortOfSpare = context.isStaff && count < REQUIRED_STAFF_FACTORS;
  const keyState: State = count === 0 ? (context.isStaff ? "attention" : "off") : shortOfSpare ? "attention" : "on";

  return (
    <>
      <AccountHeader
        title="Security"
        description="What is protecting this account, and anything still to set up."
      />

      <div className="space-y-5">
        <SecurityCard
          id="keys"
          icon="key"
          title="Security keys"
          description="Your phone, computer or a hardware key confirms it's you — nothing to type, nothing to steal."
          state={keyState}
        >
          {count > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {keys.map((key) => {
                const where = describeAuthenticator(key.aaguid);
                return (
                  <ItemRow
                    key={key.id}
                    icon="key"
                    tone="accent"
                    title={key.name}
                    meta={
                      <>
                        {where ? `${where} · ` : ""}
                        added {ukDay(key.createdAt)} ·{" "}
                        {key.lastUsedAgo ? `last used ${key.lastUsedAgo}` : "not used to sign in yet"}
                      </>
                    }
                  />
                );
              })}
            </ul>
          ) : (
            <p className="rounded-(--radius) border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              {context.isStaff
                ? "No keys yet. Staff accounts need one before reaching the admin area."
                : "No keys yet. Optional, but far stronger than a password alone."}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {count === 0
                ? "Takes under a minute."
                : shortOfSpare
                  ? `${count} key registered — add a spare on a second device so losing one isn't a lockout.`
                  : `${count} key${count === 1 ? "" : "s"} registered.`}
              {/* Whether THIS session presented a key is different from
                  whether the account has one, and staff are gated on it. */}
              {context.isStaff && count > 0
                ? mfa.current === "aal2"
                  ? " This session is verified."
                  : " You'll be asked for a key when you open the admin area."
                : ""}
            </p>
            <ButtonLink href="/account/security/mfa" variant={count === 0 ? "primary" : "outline"} size="sm">
              {count === 0 ? "Set up a security key" : "Manage security keys"}
            </ButtonLink>
          </div>
        </SecurityCard>

        {/* Every browser signed in to this account, this one first. Signing
            one out ends it on its next page load (note 05 §11.2). */}
        <SecurityCard
          id="devices"
          icon="desktop"
          title="Signed-in devices"
          description="Anywhere this account is signed in. Sign out anything you don't recognise."
          state="info"
          headerAction={
            others > 0 ? (
              <form action={signOutOtherSessionsAction}>
                <button
                  type="submit"
                  className="h-9 rounded-full border border-input-border px-4 text-sm font-medium transition-colors hover:border-error hover:text-error"
                >
                  Sign out all other devices
                </button>
              </form>
            ) : undefined
          }
        >
          <ul className="divide-y divide-border border-y border-border">
            {sessions.map((session) => {
              const d = describeDevice(session.userAgent);
              return (
                <ItemRow
                  key={session.id}
                  icon={d.mobile ? "phone" : "desktop"}
                  tone={session.current ? "accent" : "neutral"}
                  title={d.device}
                  badge={
                    session.current ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        This device
                      </span>
                    ) : null
                  }
                  meta={
                    <>
                      {d.browser ? `${d.browser} · ` : ""}
                      {session.current ? "active now" : `active ${session.lastActiveAgo}`}
                      {" · signed in "}
                      {ukDay(session.createdAt)}
                      {session.ip ? ` · ${session.ip}` : ""}
                      {session.verifiedWithKey ? " · confirmed with a key" : ""}
                    </>
                  }
                  trailing={
                    session.current ? null : (
                      <form action={signOutSessionAction}>
                        <input type="hidden" name="sessionId" value={session.id} />
                        <button
                          type="submit"
                          className="h-9 rounded-full border border-input-border px-4 text-sm font-medium transition-colors hover:border-error hover:text-error"
                        >
                          Sign out
                        </button>
                      </form>
                    )
                  }
                />
              );
            })}
          </ul>
        </SecurityCard>

        <SecurityCard
          id="password"
          icon="lock"
          title="Password"
          description="Used with your email address to sign in. Choose one you don't use anywhere else."
          state="on"
        >
          <div className="max-w-md">
            <PasswordForm />
          </div>
        </SecurityCard>

        <SecurityCard
          id="email"
          icon="mail"
          title="Email address"
          description="Where sign-in links, receipts and security alerts are sent."
          state="on"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) bg-surface-muted px-4 py-3">
            <span className="font-medium break-all">{context.email ?? "Signed in"}</span>
            <ButtonLink href="/account/profile" variant="outline" size="sm">
              Update your details
            </ButtonLink>
          </div>
        </SecurityCard>
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
