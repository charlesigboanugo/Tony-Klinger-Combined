import type { Metadata } from "next";
import Link from "next/link";

import { ProfileForm } from "@/app/account/profile/ProfileForm";
import { AccountCard as Card } from "@/components/account/AccountCard";
import { AccountHeader } from "@/components/account/AccountHeader";
import { myProfile } from "@/lib/account";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

function initialsOf(...names: Array<string | null | undefined>): string {
  const words = names.filter(Boolean).join(" ").trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words.at(-1)![0] : (words[0]?.slice(0, 2) ?? "?")).toUpperCase();
}

/**
 * Profile — note 03 §24.
 *
 * Laid out like Security and Billing (AccountCard). The name card leads with
 * how the person currently appears (initials and display name), so the effect
 * of an edit is visible.
 */
export default async function ProfilePage() {
  const context = await requireUser("/account/profile");
  const profile = await myProfile();

  const displayName = profile?.display_name ?? null;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const initials = initialsOf(fullName || displayName || context.email);

  return (
    <>
      <AccountHeader title="Profile" description="Your name, and how it appears across the site." />

      <div className="space-y-5">
        <Card icon="user" title="Your details" description="Used to greet you and on your bookings, tickets and emails.">
          <div className="mb-6 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-block-oxblood text-lg font-semibold tracking-wide text-block-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{displayName || fullName || "No name yet"}</p>
              <p className="truncate text-sm text-muted-foreground">{fullName && fullName !== displayName ? fullName : context.email}</p>
            </div>
          </div>

          <ProfileForm
            firstName={profile?.first_name ?? null}
            lastName={profile?.last_name ?? null}
            displayName={displayName}
          />
        </Card>

        <Card icon="mail" title="Email address" description="Your sign-in, and where receipts and booking emails are sent.">
          <p className="text-sm font-medium break-all">{context.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            To change the address you sign in with,{" "}
            <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
              get in touch
            </Link>{" "}
            and we&apos;ll move your account across. Your password and security keys are under{" "}
            <Link href="/account/security" className="font-medium text-primary underline-offset-4 hover:underline">
              Security
            </Link>
            .
          </p>
        </Card>
      </div>
    </>
  );
}
