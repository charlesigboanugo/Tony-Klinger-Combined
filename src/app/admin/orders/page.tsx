import type { Metadata } from "next";
import Link from "next/link";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, FilterTabs, PersonCell, humanise, ukDate } from "@/components/admin/AdminUI";
import { ORDER_STATUSES, adminOrderList, isOneOf, peopleByIds } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Orders · Admin", robots: { index: false } };

/**
 * Orders — note 06 §14, note 09 §26.
 *
 * Filtered by status through the URL. Each row opens the order: its lines,
 * payments, and what it granted.
 */
export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requirePermission("orders.read", "/admin/orders");
  const params = await searchParams;
  const status = isOneOf(ORDER_STATUSES, params.status) ? params.status : undefined;

  const { orders, counts } = await adminOrderList(status);
  const people = await peopleByIds(orders.map((o) => o.user_id));
  const unclaimed = orders.filter((o) => o.status === "paid" && !o.user_id).length;

  return (
    <>
      <AdminPageHeader
        title="Orders"
        meta={`${counts.all} in total`}
        description="Every checkout, paid or not. Open one to see its lines, payment and what it granted."
      />

      <FilterTabs
        label="Filter orders by status"
        path="/admin/orders"
        param="status"
        current={status}
        options={[
          { value: undefined, label: "All", count: counts.all },
          ...ORDER_STATUSES.filter((s) => counts[s] > 0 || s === status).map((s) => ({
            value: s,
            label: humanise(s),
            count: counts[s],
          })),
        ]}
      />

      {unclaimed > 0 ? (
        <p className="mb-5 rounded-(--radius-lg) border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <span className="font-medium">{unclaimed}</span> paid order{unclaimed === 1 ? " is" : "s are"} still
          unclaimed — a guest paid but has not linked the purchase to an account. These are real orders and
          are never cleaned up.
        </p>
      ) : null}

      <AdminTable
        headers={["Placed", "Customer", "Status", "Total", ""]}
        empty={orders.length === 0 ? (status ? `No ${humanise(status).toLowerCase()} orders.` : "No orders yet.") : undefined}
      >
        {orders.map((o) => {
          const person = o.user_id ? people.get(o.user_id) : undefined;
          return (
            <tr key={o.id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-accent">
                  {ukDate(o.created_at)}
                </Link>
                <span className="block font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</span>
              </td>
              <td className="px-4 py-3">
                <PersonCell
                  id={o.user_id}
                  name={person?.name}
                  email={person?.email ?? o.guest_email}
                  fallback="Guest"
                />
                {!o.user_id ? <span className="text-xs text-muted-foreground">Guest checkout</span> : null}
              </td>
              <td className="px-4 py-3"><StatusPill value={o.status} /></td>
              <td className="px-4 py-3 font-medium tabular-nums">{formatPrice(o.total, o.currency)}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/admin/orders/${o.id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </>
  );
}
