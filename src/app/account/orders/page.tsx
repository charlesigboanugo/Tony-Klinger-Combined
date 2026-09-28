import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader } from "@/components/account/AccountHeader";
import { ORDER_STATUS, StatusPill, statusOf } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/Field";
import { myOrders, orderTitle } from "@/lib/account";
import { formatDate } from "@/lib/account/format";
import { formatPrice } from "@/lib/commerce/pricing";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

export default async function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  await requireUser("/account/orders");
  const params = await searchParams;
  const orders = await myOrders();

  return (
    <>
      <AccountHeader title="Orders" description="Everything you've bought, newest first." />

      {params.claimed === "1" ? (
        <div className="mb-6">
          <FormMessage tone="success">
            That purchase is now attached to your account.{" "}
            <Link href="/account/entitlements" className="font-medium underline underline-offset-4">
              See your access
            </Link>
            .
          </FormMessage>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState icon="receipt"
          title="No orders yet"
          description="Receipts for everything you buy are kept here."
          action={<ButtonLink href="/coaching">Explore coaching</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card">
          {orders.map((order) => {
            const status = statusOf(ORDER_STATUS, order.status);
            return (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="group flex items-center gap-4 p-4 transition-colors hover:bg-surface-muted sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-pretty">{orderTitle(order)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-semibold tabular-nums">
                      {formatPrice(order.total, order.currency)}
                    </span>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </div>
                  <span
                    aria-hidden="true"
                    className="hidden text-muted-foreground transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 group-hover:text-accent sm:block"
                  >
                    &rarr;
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
