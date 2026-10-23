"use client";

import { OrRule } from "@/app/auth/AuthParts";
import { EmailMethods } from "@/app/auth/EmailMethods";
import { GoogleButton } from "@/app/auth/GoogleButton";
import { MagicLinkForm } from "@/app/auth/sign-in/MagicLinkForm";
import { SignInForm } from "@/app/auth/sign-in/SignInForm";

/**
 * The three supported sign-in methods — note 05 §7.1.
 *
 * Google sits above the divider because it is one click; the two email
 * methods are tabs (`EmailMethods`, shared with create account).
 */
export function SignInMethods({ next }: { next?: string }) {
  return (
    <div className="space-y-6">
      <GoogleButton next={next} />

      <OrRule>or with email</OrRule>

      <EmailMethods
        label="Email sign-in method"
        magic={<MagicLinkForm next={next} />}
        password={<SignInForm next={next} />}
      />
    </div>
  );
}
