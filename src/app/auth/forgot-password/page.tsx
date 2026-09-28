import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/app/auth/AuthCard";
import { ForgotPasswordForm } from "@/app/auth/forgot-password/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow="Reset"
      title="Reset your password"
      description="Enter the address you signed up with and we'll email you a link to set a new one. The link works once and expires."
      altPrompt="Remembered it?"
      altHref="/auth/sign-in"
      altLabel="Back to sign in"
      footer={
        <Link
          href="/auth/sign-up"
          className="underline decoration-current/40 underline-offset-4 transition-colors hover:text-accent hover:decoration-current"
        >
          Don&apos;t have an account? Create one
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
