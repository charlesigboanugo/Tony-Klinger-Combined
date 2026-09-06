import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/ui/BackLink";
import { myOrder } from "@/lib/account";
import { formatPrice } from "@/lib/commerce/pricing";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  await requireUser(`/account/orders/${id}`);

  // RLS scopes this to the signed-in customer, so another customer's order id
  // is indistinguishable from one that does not exist (note 08 §59).
  const order = await myOrder(id);
  if (!order) notFound();

  return (
    <>
      <BackLink href="/account/orders">All orders</BackLink>

      <div className="mt-6">
        <PageHeader
          title={formatPrice(order.total, order.currency)}
          description={`${order.status} · ${new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
        />
      </div>

      <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-4 p-4">
            <div>
              {/* The snapshot, not the product's current name: an order must
                  still read correctly after the catalogue changes (note 08 §40). */}
              <p className="font-medium">{item.product_name_snapshot}</p>
              <p className="text-sm text-muted-foreground">
                {item.quantity} × {formatPrice(item.unit_amount, order.currency)}
              </p>
            </div>
            <p className="font-medium">
              {formatPrice(item.total_amount, order.currency)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 max-w-xs space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatPrice(order.subtotal, order.currency)}</dd>
        </div>
        {order.discount_total > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>−{formatPrice(order.discount_total, order.currency)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-border pt-2 font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(order.total, order.currency)}</dd>
        </div>
      </dl>
    </>
  );
}
