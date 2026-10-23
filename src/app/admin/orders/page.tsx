import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, FilterTabs, humanise, PersonCell, ukDate } from "@/components/admin/AdminUI";
import { ORDER_STATUSES, adminOrderList, isOneOf, peopleByIds } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { SEARCH_DEPTH, applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
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

  const query = readQuery(params);
  const { orders: loaded, counts } = await adminOrderList(status, query ? SEARCH_DEPTH : undefined);
  const people = await peopleByIds(loaded.map((o) => o.user_id));
  // By the customer's name or email, the order number, or its status.
  const orders = searchRows(loaded, query, (o) => [
    o.user_id ? people.get(o.user_id)?.name : null,
    (o.user_id ? people.get(o.user_id)?.email : null) ?? o.guest_email,
    o.id,
    humanise(o.status),
    o.user_id ? null : "guest",
  ]);
  const sort = readSort(params, ["placed", "customer", "status", "total"], query ? undefined : { key: "placed", dir: "desc" });
  const f = applyFilters(orders, params, [
    {
      key: "customer",
      name: "Customer",
      read: (o) => (o.user_id ? "account" : "guest"),
      label: (v) => (v === "guest" ? "Guest checkout" : "Has an account"),
    },
  ]);
  const sortedOrders = sortRows(f.rows, sort, {
    placed: (o) => o.created_at,
    customer: (o) => (o.user_id ? (people.get(o.user_id)?.name ?? people.get(o.user_id)?.email) : o.guest_email),
    status: (o) => o.status,
    total: (o) => o.total,
  });
  const sortParams = params.sort ? { sort: sort?.key, dir: sort?.dir } : {};
  const kept = { ...sortParams, ...f.active, q: query };
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
        keep={kept}
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/orders"
          query={query}
          label="Customer name, email or order number"
          placeholder="Customer name, email or order number"
          keep={{ status, ...kept, q: undefined }}
        />
        <AdminSort
          path="/admin/orders"
          state={sort}
          params={{ status, ...f.active, q: query }}
          unsorted={query ? { label: "Best match" } : undefined}
          options={[
            { label: "Newest first", key: "placed", dir: "desc" },
            { label: "Oldest first", key: "placed", dir: "asc" },
            { label: "Highest total", key: "total", dir: "desc" },
            { label: "Lowest total", key: "total", dir: "asc" },
            { label: "Customer A to Z", key: "customer", dir: "asc" },
            { label: "Status", key: "status", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path="/admin/orders" {...c} params={{ status, ...kept }} />
        ))}
      </div>

      <AdminTable
        headers={[
          { label: "Placed", key: "placed", first: "desc" },
          { label: "Customer", key: "customer" },
          { label: "Status", key: "status" },
          { label: "Total", key: "total", first: "desc" },
          "",
        ]}
        sort={{ path: "/admin/orders", state: sort, params: { status, ...f.active, q: query } }}
        empty={sortedOrders.length === 0 ? (query ? `No orders match “${query}”.` : status ? `No ${humanise(status).toLowerCase()} orders.` : "No orders yet.") : undefined}
      >
        {sortedOrders.map((o) => {
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
