import type { Metadata } from "next";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { adminOrders } from "@/lib/admin";
import { formatPrice } from "@/lib/commerce/pricing";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Orders · Admin", robots: { index: false } };

export default async function AdminOrdersPage() {
  await requirePermission("orders.read", "/admin/orders");
  const orders = await adminOrders();

  const unclaimed = orders.filter((o) => o.status === "paid" && !o.user_id).length;

  return (
    <>
      <PageHeader title="Orders" description={`${orders.length} orders`} />

      {unclaimed > 0 ? (
        <p className="mb-6 rounded-(--radius) border border-warning bg-warning/10 px-4 py-3 text-sm">
          <span className="font-medium">{unclaimed}</span> paid order
          {unclaimed === 1 ? " is" : "s are"} still unclaimed — a guest paid but
          has not linked the purchase to an account. These are real orders and
          are never cleaned up; the customer can be sent a fresh claim link.
        </p>
      ) : null}

      <AdminTable
        headers={["Date", "Customer", "Total", "Status"]}
        empty={orders.length === 0 ? "No orders yet." : undefined}
      >
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-surface">
            <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString("en-GB")}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {o.user_id ? "Account" : (o.guest_email ?? "Guest")}
            </td>
            <td className="px-4 py-3">{formatPrice(o.total, o.currency)}</td>
            <td className="px-4 py-3"><StatusPill value={o.status} /></td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
