import type { Metadata } from "next";
import Link from "next/link";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardStats, recentOrders } from "@/lib/admin/dashboard";
import { formatPrice } from "@/lib/commerce/pricing";
import { getAuthContext } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

/**
 * Admin dashboard — note 06 §14, note 10 §32.
 *
 * It used to report the operator's own email, roles and permission count. That
 * answers "who am I?" when the question on opening an operational workspace is
 * "what needs me?". It now leads with the state of the business and surfaces
 * anything that is stuck.
 *
 * ATTENTION ITEMS ARE ONLY SHOWN WHEN THEY ARE NON-ZERO. A dashboard that
 * always displays "0 failed emails" trains the operator to stop reading it; a
 * row that appears only when something is actually wrong keeps its meaning.
 */
function Stat({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "alert";
}) {
  const body = (
    <>
      <dt className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-2 font-display text-3xl font-semibold tabular-nums">
        {value}
      </dd>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  const className = cn(
    "block rounded-(--radius-lg) border bg-surface p-5 shadow-card",
    tone === "alert" ? "border-warning/50" : "border-border",
    href &&
      "transition-[transform,box-shadow,border-color] duration-(--dur-base) ease-expo hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift motion-reduce:transform-none",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function AdminDashboardPage() {
  // The layout has already established that this is a staff session.
  const [context, stats, orders] = await Promise.all([
    getAuthContext(),
    dashboardStats(),
    recentOrders(),
  ]);

  const attention = [
    stats.pendingOrders > 0 && {
      label: "Orders pending",
      value: String(stats.pendingOrders),
      hint: "Started but not paid",
      href: "/admin/orders",
    },
    stats.emailsFailed > 0 && {
      label: "Emails failed",
      value: String(stats.emailsFailed),
      hint: "Abandoned after retries",
      href: "/admin/emails",
    },
    stats.emailsPending > 0 && {
      label: "Emails queued",
      value: String(stats.emailsPending),
      hint: "Waiting for the next send",
      href: "/admin/emails",
    },
    stats.draftContent > 0 && {
      label: "Drafts",
      value: String(stats.draftContent),
      hint: "Catalogue and blog, unpublished",
      href: "/admin/catalogue",
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    hint: string;
    href: string;
  }>;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${context?.email ?? "staff"} — ${context?.roles.join(", ") || "no roles"}.`}
      />

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Revenue"
          value={formatPrice(stats.revenue)}
          hint="All paid orders"
          href="/admin/payments"
        />
        <Stat
          label="Paid orders"
          value={String(stats.paidOrders)}
          href="/admin/orders"
        />
        <Stat
          label="Customers"
          value={String(stats.customers)}
          hint="Accounts created"
          href="/admin/users"
        />
        <Stat
          label="Active access"
          value={String(stats.activeEntitlements)}
          hint={`${stats.activeSubscriptions} active subscription${stats.activeSubscriptions === 1 ? "" : "s"}`}
          href="/admin/entitlements"
        />
      </dl>

      {attention.length > 0 ? (
        <section aria-labelledby="attention" className="mt-10">
          <h2 id="attention" className="font-display text-lg font-semibold">
            Needs attention
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {attention.map((item) => (
              <Stat key={item.label} {...item} tone="alert" />
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="recent" className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="recent" className="font-display text-lg font-semibold">
            Recent orders
          </h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            All orders
          </Link>
        </div>

        <AdminTable
          headers={["Placed", "Customer", "Status", "Total"]}
          empty={orders.length === 0 ? "No orders yet." : undefined}
        >
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-surface-muted">
              <td className="px-4 py-3 whitespace-nowrap">
                {new Date(order.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="max-w-[16rem] truncate px-4 py-3">
                {order.guest_email ?? "Account holder"}
              </td>
              <td className="px-4 py-3">
                <StatusPill value={order.status} />
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatPrice(order.total, order.currency)}
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Each area in the sidebar is filtered by the permissions this account
        holds. Visibility is a convenience — every page enforces its own
        permission, and the database enforces row ownership independently
        (note 06 §2).
      </p>
    </>
  );
}
