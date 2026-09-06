import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/Field";
import { myOrders } from "@/lib/account";
import { formatPrice } from "@/lib/commerce/pricing";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

export default async function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  await requireUser("/account/orders");
  const params = await searchParams;
  const orders = await myOrders();

  return (
    <>
      <PageHeader title="Orders" />

      {params.claimed === "1" ? (
        <div className="mb-6">
          <FormMessage tone="success">
            That purchase is now attached to your account.
          </FormMessage>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          action={<ButtonLink href="/coaching">Explore coaching</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-surface-muted"
              >
                <div>
                  <p className="font-medium">
                    {formatPrice(order.total, order.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs capitalize">
                  {order.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
