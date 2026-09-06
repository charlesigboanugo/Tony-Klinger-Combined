import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/app/auth/AuthCard";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

/** Landing page after sign-up, while the confirmation email is in flight. */
export default function VerifyPage() {
  return (
    <AuthCard
      title="Confirm your email"
      description="We've sent you a confirmation link. Open it to finish setting up your account."
      footer={
        <>
          Wrong address or link expired?{" "}
          <Link href="/auth/sign-up" className="underline hover:text-foreground">
            Sign up again
          </Link>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        The link expires shortly for security. If it has already lapsed, request
        a new one — nothing you have purchased is affected.
      </p>
    </AuthCard>
  );
}
