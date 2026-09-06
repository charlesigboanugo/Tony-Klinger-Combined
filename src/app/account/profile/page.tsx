import type { Metadata } from "next";

import { ProfileForm } from "@/app/account/profile/ProfileForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { myProfile } from "@/lib/account";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const context = await requireUser("/account/profile");
  const profile = await myProfile();

  return (
    <>
      <PageHeader title="Profile" description={context.email ?? undefined} />
      <ProfileForm
        firstName={profile?.first_name ?? null}
        lastName={profile?.last_name ?? null}
        displayName={profile?.display_name ?? null}
      />
      <p className="mt-6 max-w-md text-sm text-muted-foreground">
        Your email address is your sign-in identity and is managed under
        Security.
      </p>
    </>
  );
}
