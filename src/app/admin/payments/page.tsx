import type { Metadata } from "next";
import Link from "next/link";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSection, ukDate, ukDateTime } from "@/components/admin/AdminUI";
import { adminPayments, awaitingReconciliation } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Payments · Admin", robots: { index: false } };

/**
 * Payments and reconciliation — note 09 §23, §45.
 *
 * Payments are written only by the Stripe webhook. "Awaiting reconciliation"
 * lists orders the scheduled job is still checking with Stripe — a checkout
 * that may have been paid but whose webhook has not landed.
 */
export default async function AdminPaymentsPage() {
  await requirePermission("payments.read", "/admin/payments");
  const [payments, stuck] = await Promise.all([adminPayments(), awaitingReconciliation()]);

  const received = payments.filter((p) => p.status === "succeeded" || p.status === "paid");
  const total = received.reduce((sum, p) => sum + p.amount, 0);
  const currency = payments[0]?.currency ?? "GBP";

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

      <AdminSection title="All payments">
        <AdminTable
          headers={["Date", "Amount", "Status", "Provider reference", "Order", ""]}
          empty={payments.length === 0 ? "No payments yet." : undefined}
        >
          {payments.map((p) => (
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
