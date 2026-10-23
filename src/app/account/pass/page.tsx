import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader } from "@/components/account/AccountHeader";
import { StatusPill } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myMembership } from "@/lib/academy/membership";
import { formatDate } from "@/lib/account/format";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Memberships", robots: { index: false } };

/**
 * The customer's membership — note 01 §28, note 09 §16.1.
 *
 * READ FROM THE ENTITLEMENT, not from the subscription (migration 0012). This
 * page used to list `subscriptions` rows, so a member who paid once for a year
 * — who has no subscription — was told "No membership" while holding one. It
 * must not assume a subscription exists: where there is one it says when it
 * renews; where there is not it says when the membership ends and that it does
 * not renew. Note 01 §28 requires the customer to know both.
 */
export default async function MembershipsPage() {
  await requireUser("/account/pass");
  const membership = await myMembership();

  return (
    <>
      <AccountHeader title="Coaching Pass" description="Your pass, and when it ends." />

      {!membership ? (
        <EmptyState icon="star"
          title="No Coaching Pass"
          description="A Coaching Pass brings a year of live Group Coaching, the video playlists and, from Gold, a monthly Q&A with Tony."
          action={<ButtonLink href="/coaching/passes">Compare tiers</ButtonLink>}
        />
      ) : (
        <>
          <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-2xl font-semibold">{membership.tierName}</p>
              <StatusPill tone={membership.pastDue ? "warn" : "good"}>
                {membership.pastDue ? "Payment due" : "Active"}
              </StatusPill>
            </div>

            {membership.date ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {membership.renews ? "Renews" : "Access ends"} on{" "}
                <span className="font-medium text-foreground">{formatDate(membership.date)}</span>
                {membership.renews ? "" : ". It does not renew by itself."}
              </p>
            ) : null}

            {membership.pastDue ? (
              <p className="mt-3 rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
                A payment failed. Your pass carries on for a few days while it is retried. Update your payment
                method to keep it.
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/academy/pass" size="sm">
                Open your pass
              </ButtonLink>
              <ButtonLink href="/account/billing" size="sm" variant="outline">
                Billing
              </ButtonLink>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Payments, receipts and cancelling are under{" "}
            <Link href="/account/billing" className="font-medium text-primary underline-offset-4 hover:underline">
              Billing
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}
