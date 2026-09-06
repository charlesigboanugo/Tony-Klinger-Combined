import type { Metadata } from "next";

import { ClaimForm } from "@/app/account/claim/ClaimForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Claim your purchase", robots: { index: false } };

/**
 * Claim a guest purchase — note 05 §29.3.
 *
 * Reached from the email sent to the address that paid. The account layout
 * already requires a session, so an unauthenticated visitor is sent to sign in
 * with this page as their destination — token intact.
 */
export default async function ClaimPage({ searchParams }: PageProps<"/account/claim">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  if (!token) {
    return (
      <EmptyState
        title="No claim link"
        description="Open the link from your receipt email to add a guest purchase to your account."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Claim your purchase"
        description="You bought this as a guest. Linking it to this account gives you access."
      />
      <div className="max-w-md rounded-(--radius) border border-border bg-surface p-6">
        <ClaimForm token={token} />
        <p className="mt-4 text-xs text-muted-foreground">
          Purchases are linked to the account you are signed in as now. If that
          is the wrong account, sign out and sign in as the right one before
          continuing.
        </p>
      </div>
    </>
  );
}
