import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountHeader } from "@/components/account/AccountHeader";
import { ORDER_STATUS, StatusPill, statusOf } from "@/components/account/StatusPill";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { myOrder } from "@/lib/account";
import { receiptForOrder } from "@/lib/account/billing";
import { formatDate } from "@/lib/account/format";
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
  // Stripe's receipt (or, for a membership, its invoice) — migration 0021.
  const receipt = await receiptForOrder(order.id);
  const status = statusOf(ORDER_STATUS, order.status);

  return (
    <>
      <BackLink href="/account/orders">All orders</BackLink>

      <AccountHeader
        title={formatPrice(order.total, order.currency)}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            <span>
              Ordered {formatDate(order.created_at)}
              {order.paid_at ? ` · paid ${formatDate(order.paid_at)}` : ""}
            </span>
          </span>
        }
        actions={
          receipt?.receiptUrl || receipt?.pdfUrl ? (
            <span className="flex flex-wrap gap-2">
              {receipt.receiptUrl ? (
                <ButtonLink href={receipt.receiptUrl} size="sm" variant="outline" target="_blank" rel="noopener noreferrer">
                  View receipt &#8599;
                </ButtonLink>
              ) : null}
              {receipt.pdfUrl ? (
                <ButtonLink href={receipt.pdfUrl} size="sm" variant="outline" target="_blank" rel="noopener noreferrer">
                  Download PDF
                </ButtonLink>
              ) : null}
            </span>
          ) : null
        }
      />

      <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-4 p-4 sm:p-5">
            <div>
              {/* The snapshot, not the product's current name: an order must
                  still read correctly after the catalogue changes (note 08 §40). */}
              <p className="font-medium">{item.product_name_snapshot}</p>
              <p className="text-sm text-muted-foreground">
                {item.quantity} × {formatPrice(item.unit_amount, order.currency)}
              </p>
            </div>
            <p className="shrink-0 font-medium tabular-nums">
              {formatPrice(item.total_amount, order.currency)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-2 text-sm sm:ml-auto sm:max-w-xs">
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

      <p className="mt-8 text-sm text-muted-foreground">
        {order.status === "paid"
          ? receipt?.receiptUrl
            ? "Receipts are issued by Stripe, our payment processor. We also emailed you a confirmation when you paid."
            : "Your receipt is being prepared by Stripe — check back shortly."
          : null}{" "}
        Questions about a payment?{" "}
        <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
          Get in touch
        </Link>
        .
      </p>
    </>
  );
}
