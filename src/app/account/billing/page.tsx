import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myOrders, mySubscriptions } from "@/lib/account";
import { formatPrice } from "@/lib/commerce/pricing";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Billing — note 03 §24, note 10 §31.
 *
 * This was an empty placeholder. It now answers the questions note 01 §28
 * requires a customer to be able to answer about their own money: what is
 * being charged, when the next charge falls, and what has already been paid.
 *
 * MEMBERSHIP RENEWAL IS STATED EXPLICITLY, INCLUDING WHEN IT DOES NOT RENEW.
 * A tier bought as a lump sum has no subscription at all (note 09 §16.1), so
 * an interface that only lists subscriptions silently tells a lump-sum member
 * nothing — they would have no way to learn their access simply lapses. Where
 * there is no subscription this page says so in as many words.
 */
export default async function BillingPage() {
  await requireUser("/account/billing");

  const [subscriptions, orders] = await Promise.all([
    mySubscriptions(),
    myOrders(),
  ]);

  const paid = orders.filter((o) => o.status === "paid");

  return (
    <>
      <PageHeader
        title="Billing"
        description="What you are charged, when it renews, and everything paid so far."
      />

      <section aria-labelledby="recurring" className="mb-10">
        <h2 id="recurring" className="font-display text-lg font-semibold">
          Recurring payments
        </h2>

        {subscriptions.length === 0 ? (
          <div className="mt-4 rounded-(--radius-lg) border border-border bg-surface p-5">
            <p className="text-sm font-medium">Nothing renews automatically</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You have no active subscription. If you bought a membership as a
              single payment it runs for a fixed year and then simply ends —
              it does not renew, and nothing will be charged again.{" "}
              <Link
                href="/account/entitlements"
                className="text-primary underline underline-offset-4"
              >
                Check when your access ends
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {subscriptions.map((s) => (
              <li
                key={s.id}
                className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-semibold capitalize">
                    {s.membership_tier ?? "Membership"}
                  </p>
                  <span className="rounded-full border border-border px-3 py-1 text-xs capitalize">
                    {s.status.replace("_", " ")}
                  </span>
                </div>

                {s.current_period_end ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {s.cancel_at ? "Access ends on " : "Next payment due "}
                    <span className="font-medium text-foreground">
                      {formatDate(s.current_period_end)}
                    </span>
                  </p>
                ) : null}

                {s.status === "past_due" ? (
                  <p className="mt-3 rounded-(--radius) border border-warning bg-warning/10 p-3 text-sm">
                    A payment failed. Your access continues during the grace
                    period — update your card to avoid interruption.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="font-display text-lg font-semibold">
          Payment history
        </h2>

        {paid.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nothing paid yet"
              description="Receipts appear here as soon as an order is completed."
              action={<ButtonLink href="/coaching">Browse coaching</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-(--radius-lg) border border-border bg-surface">
            {paid.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {order.paid_at ? formatDate(order.paid_at) : formatDate(order.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Order {order.id.slice(0, 8)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-medium tabular-nums">
                    {formatPrice(order.total, order.currency)}
                  </span>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Card details are held by Stripe and never reach this site. To change
          the card on a subscription, contact us and we will send you a secure
          link.
        </p>
      </section>
    </>
  );
}
