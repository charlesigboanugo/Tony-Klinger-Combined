import type { Metadata } from "next";

import { AuthCard } from "@/app/auth/AuthCard";
import { SignUpForm } from "@/app/auth/sign-up/SignUpForm";
import { GoogleButton } from "@/app/auth/GoogleButton";
import { safeRedirect } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignUpPage({ searchParams }: PageProps<"/auth/sign-up">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = rawNext ? safeRedirect(rawNext) : undefined;

  return (
    <AuthCard
      title="Create your account"
      description="Browsing is open to everyone. An account is only needed for what you buy."
      altPrompt="Already have an account?"
      altHref={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}
      altLabel="Sign in"
    >
      <div className="space-y-6">
        <GoogleButton next={next} label="Continue with Google" />

        {/* "or" rule. aria-hidden because it is a visual separator; announcing
            "or" between two labelled regions adds nothing for a screen reader. */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            or sign up with email
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <SignUpForm next={next} />
      </div>
    </AuthCard>
  );
}
