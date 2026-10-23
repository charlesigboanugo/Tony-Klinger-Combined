import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, AdminSection, humanise, ukDate, ukDateTime } from "@/components/admin/AdminUI";
import { adminPayments, awaitingReconciliation, peopleByIds } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { SEARCH_DEPTH, applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Payments · Admin", robots: { index: false } };

/**
 * Payments and reconciliation — note 09 §23, §45.
 *
 * Payments are written only by the Stripe webhook. "Awaiting reconciliation"
 * lists orders the scheduled job is still checking with Stripe — a checkout
 * that may have been paid but whose webhook has not landed.
 */
export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requirePermission("payments.read", "/admin/payments");
  const params = await searchParams;
  const query = readQuery(params);
  const [loaded, stuck] = await Promise.all([
    adminPayments(query ? SEARCH_DEPTH : undefined),
    awaitingReconciliation(),
  ]);
  const people = await peopleByIds(loaded.map((p) => p.user_id));
  // By who paid, the provider's reference, the order number, or the status.
  const payments = searchRows(loaded, query, (p) => [
    p.user_id ? people.get(p.user_id)?.name : null,
    (p.user_id ? people.get(p.user_id)?.email : null) ?? p.guest_email,
    p.provider_payment_id,
    p.order_id,
    humanise(p.status),
  ]);

  const received = payments.filter((p) => p.status === "succeeded" || p.status === "paid");
  const total = received.reduce((sum, p) => sum + p.amount, 0);
  const currency = payments[0]?.currency ?? "GBP";

  const sort = readSort(params, ["date", "amount", "status"], query ? undefined : { key: "date", dir: "desc" });
  const f = applyFilters(payments, params, [
    { key: "status", name: "Status", read: (p) => p.status, label: humanise },
  ]);
  const sortParams = params.sort ? { sort: sort?.key, dir: sort?.dir } : {};
  const sortedPayments = sortRows(f.rows, sort, {
    date: (p) => p.paid_at ?? p.created_at,
    amount: (p) => p.amount,
    status: (p) => p.status,
  });

  return (
    <>
      <AdminPageHeader
        title="Payments"
        meta={`${payments.length} recorded`}
        description={`${formatPrice(total, currency)} received across ${received.length} payment${received.length === 1 ? "" : "s"}. Refunds and disputes are handled in Stripe.`}
        actions={
          <a
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input-border px-4 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Open Stripe <span aria-hidden="true">&#8599;</span>
          </a>
        }
      />

      {stuck.length > 0 ? (
        <AdminSection
          title="Awaiting reconciliation"
          description="Checkouts started but not confirmed. The reconciliation job checks these with Stripe automatically."
        >
          <AdminTable headers={["Started", "Total", "Status", ""]}>
            {stuck.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">{ukDateTime(o.created_at)}</td>
                <td className="px-4 py-3 tabular-nums">{formatPrice(o.total, o.currency)}</td>
                <td className="px-4 py-3"><StatusPill value={o.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                    Open order
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminSection>
      ) : null}

      <AdminSection
        title="All payments"
        action={
          <div className="flex flex-wrap items-center gap-2">
          <AdminSearch
            path="/admin/payments"
            query={query}
            label="Customer, reference or order number"
            placeholder="Customer, reference or order number"
            keep={{ ...sortParams, ...f.active }}
          />
          <AdminSort
            path="/admin/payments"
            state={sort}
            params={{ ...f.active, q: query }}
            unsorted={query ? { label: "Best match" } : undefined}
            options={[
              { label: "Newest first", key: "date", dir: "desc" },
              { label: "Oldest first", key: "date", dir: "asc" },
              { label: "Largest amount", key: "amount", dir: "desc" },
              { label: "Smallest amount", key: "amount", dir: "asc" },
              { label: "Status", key: "status", dir: "asc" },
            ]}
          />
            {f.controls.map((c) => (
              <AdminFilter key={c.param} path="/admin/payments" {...c} params={{ ...sortParams, ...f.active, q: query }} />
            ))}
          </div>
        }
      >
        <AdminTable
          headers={[
            { label: "Date", key: "date", first: "desc" },
            { label: "Amount", key: "amount", first: "desc" },
            { label: "Status", key: "status" },
            "Provider reference",
            "Order",
            "",
          ]}
          sort={{ path: "/admin/payments", state: sort, params: { ...f.active, q: query } }}
          empty={sortedPayments.length === 0 ? (query ? `No payments match “${query}”.` : "No payments yet.") : undefined}
        >
          {sortedPayments.map((p) => (
            <tr key={p.id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-3 whitespace-nowrap">{ukDate(p.paid_at ?? p.created_at)}</td>
              <td className="px-4 py-3 font-medium tabular-nums">{formatPrice(p.amount, p.currency)}</td>
              <td className="px-4 py-3"><StatusPill value={p.status} /></td>
              <td className="max-w-56 truncate px-4 py-3 font-mono text-xs text-muted-foreground">{p.provider_payment_id}</td>
              <td className="px-4 py-3">
                {p.order_id ? (
                  <Link href={`/admin/orders/${p.order_id}`} className="font-mono text-xs hover:text-accent">
                    #{p.order_id.slice(0, 8)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
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
    </>
  );
}
