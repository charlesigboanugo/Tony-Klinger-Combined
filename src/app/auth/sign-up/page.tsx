import type { Metadata } from "next";

import { AuthCard } from "@/app/auth/AuthCard";
import { SignUpForm } from "@/app/auth/sign-up/SignUpForm";
import { OrRule } from "@/app/auth/AuthParts";
import { GoogleButton } from "@/app/auth/GoogleButton";
import { safeRedirect } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignUpPage({ searchParams }: PageProps<"/auth/sign-up">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = rawNext ? safeRedirect(rawNext) : undefined;

  return (
    <AuthCard
      eyebrow="Create account"
      title="Create your account"
      description="Browsing is open to everyone. An account is only needed for what you buy."
      altPrompt="Already have an account?"
      altHref={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}
      altLabel="Sign in"
    >
      <div className="space-y-6">
        <GoogleButton next={next} label="Continue with Google" />

        <OrRule>or sign up with email</OrRule>

        <SignUpForm next={next} />
      </div>
    </AuthCard>
  );
}
