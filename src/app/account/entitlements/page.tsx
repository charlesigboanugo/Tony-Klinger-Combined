import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  RESOURCE_LABELS,
  SOURCE_LABELS,
  myEntitlements,
} from "@/lib/account";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Your access", robots: { index: false } };

/**
 * The customer-facing entitlement view — R23, note 03 §24.
 *
 * Read-only and strictly this customer's own. Unrelated to /admin/entitlements,
 * which grants and revokes across all customers (note 06 §23.1).
 */
export default async function EntitlementsPage() {
  await requireUser("/account/entitlements");
  const entitlements = await myEntitlements();

  const live = entitlements.filter((e) => e.status === "active");
  const ended = entitlements.filter((e) => e.status !== "active");

  return (
    <>
      <PageHeader title="Your access"
        description="What you can use, where it came from, and when it ends."
      />

      {entitlements.length === 0 ? (
        <EmptyState
          title="No access yet"
          description="Anything you buy — or that comes with a membership — appears here."
          action={<ButtonLink href="/coaching">Explore coaching</ButtonLink>}
        />
      ) : (
        <div className="space-y-8">
          {live.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Active
              </h2>
              <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface">
                {live.map((e) => (
                  <li key={e.id} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {RESOURCE_LABELS[e.resource_type] ?? e.resource_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {SOURCE_LABELS[e.source_type] ?? e.source_type}
                      </p>
                    </div>
                    <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
                      {e.quantity != null ? (
                        <div className="flex gap-2">
                          <dt>Remaining</dt>
                          <dd className="font-medium text-foreground">
                            {e.quantity - e.quantity_used} of {e.quantity}
                          </dd>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <dt>Usage</dt>
                          <dd className="font-medium text-foreground">Unlimited</dd>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <dt>Ends</dt>
                        <dd className="font-medium text-foreground">
                          {e.expires_at
                            ? new Date(e.expires_at).toLocaleDateString("en-GB")
                            : "No end date"}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ended.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Ended
              </h2>
              <ul className="divide-y divide-border rounded-(--radius) border border-border">
                {ended.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-4 p-4">
                    <p className="text-muted-foreground">
                      {RESOURCE_LABELS[e.resource_type] ?? e.resource_type}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{e.status}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Ended access is kept on record — it explains past orders and can
                be restored if you renew.
              </p>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
