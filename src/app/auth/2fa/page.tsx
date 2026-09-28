import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/app/auth/AuthCard";
import { Challenge } from "@/app/auth/2fa/Challenge";
import { DEFAULT_REDIRECT, safeRedirect } from "@/lib/auth/safe-redirect";
import { getMfaState } from "@/lib/auth/mfa";
import { publicEnv } from "@/lib/env/public";
import { requireSession } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Confirm it's you",
  robots: { index: false },
};

/**
 * The two-factor step of signing in — note 05 §11.1, note 04 §17.
 *
 * A DEDICATED STEP IN THE AUTH FLOW, not a settings screen. Staff needing a
 * second factor were previously redirected to `/account/security/mfa`, the page
 * for MANAGING keys, where they had to locate a button among enrolment
 * controls. That inverted the usual shape of two-factor authentication: the
 * challenge belongs immediately after the password, in the minimal auth chrome,
 * with nothing else on screen.
 *
 * It lives under `/auth` so it inherits the task-focused layout (note 04 §17) —
 * no site navigation, nothing to wander into mid-authentication.
 *
 * Enrolment is still the settings page's job. This route only ever CHALLENGES,
 * and it refuses to be a dead end: an account with no keys is sent to enrol
 * instead of being shown a button that cannot work.
 */
export default async function TwoFactorPage({
  searchParams,
}: PageProps<"/auth/2fa">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = (rawNext ? safeRedirect(rawNext) : undefined) ?? DEFAULT_REDIRECT;

  const context = await requireSession(`/auth/2fa`);
  const mfa = await getMfaState();

  /*
    `?confirm=1` is a deliberate RE-confirmation before a sensitive change
    (removing a key — migration 0022 requires a key used in the last few
    minutes), so an already-verified session is challenged again rather than
    waved through. Without it, arriving here verified would be a loop.
  */
  const reconfirm = params.confirm === "1";
  if (mfa.current === "aal2" && !reconfirm) redirect(next);

  // Nothing to challenge. Enrolment is a different job on a different page.
  if (mfa.factors.length === 0) {
    redirect(`/account/security/mfa?required=1`);
  }

  const site = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);

  return (
    <AuthCard
      eyebrow="Security key"
      title="Confirm it's you"
      description={
        reconfirm
          ? "Changing your security keys needs a fresh confirmation. Use one of your keys — you'll go straight back."
          : "Use the security key registered to this account. You are not creating a new one."
      }
      escape={false}
      /*
        An honest answer, not a link to a page where nothing can be done.

        Somebody at `aal1` cannot enrol a replacement — Supabase refuses a
        second factor from an unverified session — so pointing them at key
        management would be a dead end at the exact moment they are stuck.
        Clearing a lost key is an administrative act (note 05 §11.1), so the
        footer says who performs it.
      */
      footer={
        context.isStaff ? (
          <>
            Lost your key? Another administrator can clear it for you — it is
            recorded in the audit log.
          </>
        ) : (
          <>
            Lost your key?{" "}
            <Link
              href="/contact"
              className="underline decoration-current/40 underline-offset-4 transition-colors hover:text-accent hover:decoration-current"
            >
              Ask us to remove it
            </Link>{" "}
            and you can register a new one.
          </>
        )
      }
    >
      <Challenge
        factors={mfa.factors}
        rpId={site.hostname}
        origin={site.origin}
        next={next}
      />
    </AuthCard>
  );
}
