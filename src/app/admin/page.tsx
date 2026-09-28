import type { Metadata } from "next";
import Link from "next/link";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSection, PersonCell, ukDate } from "@/components/admin/AdminUI";
import { IconTile, type IconName } from "@/components/ui/Icon";
import { dashboardStats, recentOrders } from "@/lib/admin/dashboard";
import { peopleByIds } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { can, getAuthContext } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

/**
 * Admin dashboard — note 06 §14, note 10 §32.
 *
 * Answers "what needs me?" before "how are we doing?": the attention row
 * leads, and appears only when something is actually waiting — a dashboard
 * that always shows "0 failed emails" trains the operator to stop reading it.
 * Then the business at a glance, the shortcuts this operator's permissions
 * allow, and the latest orders.
 */
function Stat({
  label,
  value,
  hint,
  href,
  icon,
  tone = "default",
}: {
  icon?: IconName;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "alert";
}) {
  const body = (
    <>
      {/* Icons only where they help tell items apart: the "Needs attention"
          cards are different KINDS of problem (an enquiry, an order, an
          email), so each carries one, on the right. The "At a glance"
          figures are all just numbers, and eight icons in two rows choked
          the dashboard (owner, 2026-09-27). */}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
        {icon ? <IconTile name={icon} tone={tone === "alert" ? "warning" : "accent"} size="sm" /> : null}
      </div>
      <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <p className="mt-1 min-h-4 text-xs text-muted-foreground">{hint ?? "\u00a0"}</p>
    </>
  );

  const className = cn(
    "group block h-full rounded-(--radius-lg) border bg-surface p-5 shadow-card",
    tone === "alert" ? "border-warning/50" : "border-border",
    href &&
      "transition-[transform,box-shadow,border-color] duration-(--dur-base) ease-expo hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift motion-reduce:transform-none",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function greeting() {
  const hour = Number(
    new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function AdminDashboardPage() {
  // The layout has already established that this is a staff session.
  const [context, stats, orders] = await Promise.all([
    getAuthContext(),
    dashboardStats(),
    recentOrders(),
  ]);
  const people = await peopleByIds(orders.map((o) => o.user_id));
  const may = (permission: string) => (context ? can(context, permission) : false);

  const attention = [
    stats.unreadEnquiries > 0 && {
      label: "New enquiries",
      icon: "mail" as IconName,
      value: String(stats.unreadEnquiries),
      hint: "From the contact form, unread",
      href: "/admin/enquiries?status=new",
    },
    stats.pendingOrders > 0 && {
      label: "Orders pending",
      icon: "bag" as IconName,
      value: String(stats.pendingOrders),
      hint: "Started but not paid",
      href: "/admin/orders?status=pending",
    },
    stats.emailsFailed > 0 && {
      label: "Emails failed",
      icon: "alert" as IconName,
      value: String(stats.emailsFailed),
      hint: "Abandoned after retries",
      href: "/admin/emails?status=failed",
    },
    stats.emailsPending > 0 && {
      label: "Emails queued",
      icon: "clock" as IconName,
      value: String(stats.emailsPending),
      hint: "Waiting for the next send",
      href: "/admin/emails?status=pending",
    },
    stats.draftContent > 0 && {
      label: "Drafts",
      icon: "pencil" as IconName,
      value: String(stats.draftContent),
      hint: "Catalogue and blog, unpublished",
      href: "/admin/catalogue",
    },
  ].filter(Boolean) as Array<{ label: string; icon: IconName; value: string; hint: string; href: string }>;

  const shortcuts = [
    may("blog.create") && { href: "/admin/blog/new", icon: "pencil" as IconName, label: "Write a blog post" },
    may("events.create") && { href: "/admin/events/new", icon: "ticket" as IconName, label: "Add an event" },
    may("coaching.manage") && { href: "/admin/coaching-slots/new", icon: "clock" as IconName, label: "Open a coaching time" },
    may("events.read") && { href: "/admin/check-in", icon: "check" as IconName, label: "Event check-in" },
    may("entitlements.grant") && { href: "/admin/entitlements", icon: "key" as IconName, label: "Grant access" },
    may("users.read") && { href: "/admin/users", icon: "search" as IconName, label: "Find a person" },
  ].filter(Boolean) as Array<{ href: string; icon: IconName; label: string }>;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London",
  });

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`${greeting()}. ${today}.`}
      />

      {attention.length > 0 ? (
        <AdminSection title="Needs attention" description="Only shown when something is waiting.">
          <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {attention.map((item) => (
              <Stat key={item.label} {...item} tone="alert" />
            ))}
          </dl>
        </AdminSection>
      ) : (
        <p className="mb-2 flex items-center gap-3 rounded-(--radius-lg) border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          <IconTile name="check" tone="success" size="sm" /> Nothing needs attention right now.
        </p>
      )}

      <AdminSection title="At a glance">
        <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Revenue" value={formatPrice(stats.revenue)} hint="All paid orders" href="/admin/payments" />
          <Stat label="Paid orders" value={String(stats.paidOrders)} href="/admin/orders?status=paid" />
          <Stat label="Accounts" value={String(stats.customers)} hint="Everyone signed up" href="/admin/users" />
          <Stat
            label="Active access"
            value={String(stats.activeEntitlements)}
            hint={`${stats.activeSubscriptions} active subscription${stats.activeSubscriptions === 1 ? "" : "s"}`}
            href="/admin/entitlements"
          />
        </dl>
      </AdminSection>

      {shortcuts.length > 0 ? (
        <AdminSection title="Shortcuts">
          <ul className="flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium shadow-card transition-colors hover:border-accent/50 hover:text-accent"
                >
                  {s.label} <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminSection>
      ) : null}

      <AdminSection
        title="Recent orders"
        action={
          <Link href="/admin/orders" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            All orders
          </Link>
        }
      >
        <AdminTable
          headers={["Placed", "Customer", "Status", "Total"]}
          empty={orders.length === 0 ? "No orders yet." : undefined}
        >
          {orders.map((order) => {
            const person = order.user_id ? people.get(order.user_id) : undefined;
            return (
              <tr key={order.id} className="hover:bg-surface-muted/60">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:text-accent">
                    {ukDate(order.created_at)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <PersonCell
                    id={order.user_id}
                    name={person?.name}
                    email={person?.email ?? order.guest_email}
                    fallback="Guest"
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={order.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatPrice(order.total, order.currency)}
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </AdminSection>
    </>
  );
}
