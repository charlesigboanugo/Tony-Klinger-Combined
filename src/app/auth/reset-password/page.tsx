import type { Metadata } from "next";

import { AuthCard } from "@/app/auth/AuthCard";
import { ResetPasswordForm } from "@/app/auth/reset-password/ResetPasswordForm";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };

/**
 * Reached from the recovery email via /auth/callback, which exchanges the code
 * and establishes the session. The action re-checks that a session exists
 * before updating anything (note 05 §9).
 *
 * ALSO WHERE AN INVITATION LANDS (note 06 §14.2), which is why the wording is
 * conditional. Telling somebody who has never had an account to set a "new"
 * password, and offering to resend a link they never lost, reads as though they
 * have arrived at the wrong page.
 */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/auth/reset-password">) {
  const params = await searchParams;
  const invited = params.invited === "1";

  return (
    <AuthCard
      title={invited ? "Set your password" : "Set a new password"}
      description={
        invited
          ? "Welcome. Choose a password you don't use anywhere else — you'll stay signed in on this device once it's saved."
          : "Choose one you don't use anywhere else. You'll stay signed in on this device once it's saved."
      }
      altPrompt={invited ? undefined : "Link expired or already used?"}
      altHref={invited ? undefined : "/auth/forgot-password"}
      altLabel={invited ? undefined : "Send a new one"}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
