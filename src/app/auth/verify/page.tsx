import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/app/auth/AuthCard";
import { AuthNotice } from "@/app/auth/AuthParts";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

/** Landing page after sign-up, while the confirmation email is in flight. */
export default function VerifyPage() {
  return (
    <AuthCard
      eyebrow="Confirm email"
      title="Confirm your email"
      description="We've sent you a confirmation link. Open it to finish setting up your account."
      footer={
        <>
          Wrong address or link expired?{" "}
          <Link
            href="/auth/sign-up"
            className="underline decoration-current/40 underline-offset-4 transition-colors hover:text-accent hover:decoration-current"
          >
            Sign up again
          </Link>
        </>
      }
    >
      <AuthNotice title="Check your inbox">
        The link expires shortly for security. If it has already lapsed,
        request a new one — nothing you have purchased is affected.
      </AuthNotice>
    </AuthCard>
  );
}
