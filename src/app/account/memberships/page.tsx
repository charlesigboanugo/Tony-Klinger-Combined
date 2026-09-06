import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { mySubscriptions } from "@/lib/account";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Memberships", robots: { index: false } };

export default async function MembershipsPage() {
  await requireUser("/account/memberships");
  const subscriptions = await mySubscriptions();

  return (
    <>
      <PageHeader title="Memberships" description="Your membership and when it renews." />

      {subscriptions.length === 0 ? (
        <EmptyState
          title="No membership"
          description="Membership tiers are cumulative — each includes everything below it."
          action={<ButtonLink href="/coaching/memberships">Compare tiers</ButtonLink>}
        />
      ) : (
        <ul className="space-y-4">
          {subscriptions.map((s) => (
            <li key={s.id} className="rounded-(--radius) border border-border bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-medium capitalize">
                  {s.membership_tier ?? "Membership"}
                </p>
                <span className="rounded-full border border-border px-3 py-1 text-xs capitalize">
                  {s.status.replace("_", " ")}
                </span>
              </div>
              {s.current_period_end ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {s.cancel_at ? "Access ends" : "Renews"} on{" "}
                  {new Date(s.current_period_end).toLocaleDateString("en-GB", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              ) : null}
              {s.status === "past_due" ? (
                <p className="mt-2 text-sm text-warning">
                  A payment failed. Access continues during the grace period —
                  update your payment method to avoid interruption.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
