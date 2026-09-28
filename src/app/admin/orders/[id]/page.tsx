import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSection, DetailGrid, PersonCell, humanise, ukDateTime } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import { BOOKABLE_LABEL, adminOrderDetail, peopleByIds } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Order · Admin", robots: { index: false } };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * One order — what was bought, how it was paid, and what it granted
 * (note 09 §23–§27: payment → order → entitlement → booking).
 */
export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requirePermission("orders.read", `/admin/orders/${id}`);
  if (!UUID.test(id)) notFound();

  const { order, items, payments, bookings, entitlements } = await adminOrderDetail(id);
  if (!order) notFound();

  const person = order.user_id ? (await peopleByIds([order.user_id])).get(order.user_id) : undefined;

  return (
    <>
      <BackLink href="/admin/orders">All orders</BackLink>

      <AdminPageHeader
        title={`Order #${order.id.slice(0, 8)}`}
        meta={<StatusPill value={order.status} />}
        description={`Placed ${ukDateTime(order.created_at)}${order.paid_at ? ` · paid ${ukDateTime(order.paid_at)}` : ""}`}
      />

      <DetailGrid
        items={[
          {
            label: "Customer",
            value: (
              <PersonCell
                id={order.user_id}
                name={person?.name}
                email={person?.email ?? order.guest_email}
                fallback="Guest"
              />
            ),
          },
          { label: "Account", value: order.user_id ? "Signed-in checkout" : "Guest — not yet claimed" },
          { label: "Total", value: formatPrice(order.total, order.currency) },
          {
            label: "Subtotal / discount",
            value: `${formatPrice(order.subtotal, order.currency)} / ${formatPrice(order.discount_total, order.currency)}`,
          },
          { label: "Checkout", value: humanise(order.checkout_mode) },
          {
            label: "Stripe reference",
            value: order.external_reference ? (
              <span className="font-mono text-xs">{order.external_reference}</span>
            ) : (
              "—"
            ),
          },
        ]}
      />

      <AdminSection title="Items">
        <AdminTable headers={["Product", "Qty", "Unit", "Line total"]} empty={items.length === 0 ? "No lines recorded." : undefined}>
          {items.map((line) => (
            <tr key={line.id}>
              <td className="px-4 py-3 font-medium">{line.product_name_snapshot}</td>
              <td className="px-4 py-3 tabular-nums">{line.quantity}</td>
              <td className="px-4 py-3 tabular-nums">{formatPrice(line.unit_amount, order.currency)}</td>
              <td className="px-4 py-3 font-medium tabular-nums">{formatPrice(line.total_amount, order.currency)}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>

      <AdminSection title="Payments" description="Recorded by the Stripe webhook — never by the browser.">
        <AdminTable headers={["When", "Amount", "Status", "Provider reference", ""]} empty={payments.length === 0 ? "No payment recorded." : undefined}>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 whitespace-nowrap">{ukDateTime(p.paid_at ?? p.created_at)}</td>
              <td className="px-4 py-3 font-medium tabular-nums">{formatPrice(p.amount, p.currency)}</td>
              <td className="px-4 py-3"><StatusPill value={p.status} /></td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.provider_payment_id}</td>
              <td className="px-4 py-3 text-right">
                {p.receipt_url ? (
                  <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                    Receipt
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>

      <AdminSection title="Access granted" description="Entitlements this order created.">
        <AdminTable headers={["Resource", "Status", "Remaining", "Expires"]} empty={entitlements.length === 0 ? "Nothing granted (yet)." : undefined}>
          {entitlements.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3">{humanise(e.resource_type)}</td>
              <td className="px-4 py-3"><StatusPill value={e.status} /></td>
              <td className="px-4 py-3 tabular-nums">
                {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used} of ${e.quantity}`}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{ukDateTime(e.expires_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>

      {bookings.length > 0 ? (
        <AdminSection
          title="Bookings"
          action={
            <Link href="/admin/bookings" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              All bookings
            </Link>
          }
        >
          <AdminTable headers={["What", "When", "Status", "Reference"]}>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">{BOOKABLE_LABEL[b.bookable_type as keyof typeof BOOKABLE_LABEL] ?? humanise(String(b.bookable_type))}</td>
                <td className="px-4 py-3">{ukDateTime(b.starts_at)}</td>
                <td className="px-4 py-3"><StatusPill value={b.status} /></td>
                <td className="px-4 py-3 font-mono text-xs">{b.reference ?? "—"}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminSection>
      ) : null}
    </>
  );
}
