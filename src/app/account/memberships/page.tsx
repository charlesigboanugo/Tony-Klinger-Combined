import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader } from "@/components/account/AccountHeader";
import { SUBSCRIPTION_STATUS, StatusPill, statusOf } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { mySubscriptions } from "@/lib/account";
import { formatDate } from "@/lib/account/format";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Memberships", robots: { index: false } };

export default async function MembershipsPage() {
  await requireUser("/account/memberships");
  const subscriptions = await mySubscriptions();

  return (
    <>
      <AccountHeader title="Memberships" description="Your membership and when it renews." />

      {subscriptions.length === 0 ? (
        <EmptyState icon="star"
          title="No membership"
          description="Membership tiers are cumulative — each includes everything below it."
          action={<ButtonLink href="/coaching/memberships">Compare tiers</ButtonLink>}
        />
      ) : (
        <>
          <ul className="space-y-5">
            {subscriptions.map((s) => (
              <li
                key={s.id}
                className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-2xl font-semibold capitalize">
                    {s.membership_tier ?? "Membership"}
                  </p>
                  <StatusPill tone={statusOf(SUBSCRIPTION_STATUS, s.status).tone}>
                    {statusOf(SUBSCRIPTION_STATUS, s.status).label}
                  </StatusPill>
                </div>
                {s.current_period_end ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {s.cancel_at ? "Access ends" : "Renews"} on{" "}
                    <span className="font-medium text-foreground">
                      {formatDate(s.current_period_end)}
                    </span>
                  </p>
                ) : null}
                {s.status === "past_due" ? (
                  <p className="mt-3 rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
                    A payment failed. Access continues during the grace period —
                    update your payment method to avoid interruption.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Payments and renewals are under{" "}
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
