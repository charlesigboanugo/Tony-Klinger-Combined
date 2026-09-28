import type { Metadata } from "next";

import { AuthCard } from "@/app/auth/AuthCard";
import { SignInMethods } from "@/app/auth/sign-in/SignInMethods";
import { FormMessage } from "@/components/ui/Field";
import { safeRedirect } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  missing_code: "That link was incomplete. Please request a new one.",
  invalid_link: "That link has expired or has already been used.",
  oauth_unavailable: "Google sign-in is unavailable right now. Try email instead.",
  unverified_email:
    "Google did not confirm that email address belongs to you, so we could not sign you in.",
};

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  // searchParams is a Promise in Next 16 — synchronous access was removed.
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = rawNext ? safeRedirect(rawNext) : undefined;
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  return (
    <AuthCard
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in with Google, a password, or a link sent to your email — whichever you used before."
      altPrompt="Don't have an account yet?"
      altHref={next ? `/auth/sign-up?next=${encodeURIComponent(next)}` : "/auth/sign-up"}
      altLabel="Create one"
    >
      {errorKey && ERRORS[errorKey] ? (
        <div className="mb-5">
          <FormMessage>{ERRORS[errorKey]}</FormMessage>
        </div>
      ) : null}
      <SignInMethods next={next} />
    </AuthCard>
  );
}
