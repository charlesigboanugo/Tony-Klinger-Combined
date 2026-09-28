import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPageHeader, AdminSection, ukDateTime } from "@/components/admin/AdminUI";
import { IconTile, type IconName } from "@/components/ui/Icon";
import { systemStatus } from "@/lib/admin/operations";
import { can, requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings · Admin", robots: { index: false } };

/**
 * System status — note 01 §17, note 09 §49.
 *
 * Configuration lives in environment variables set at deploy time, not in the
 * database, so there is nothing to edit here and the page does not pretend
 * otherwise. What it gives an operator is the answer to "is everything
 * connected?": each integration, whether it is configured, and the last sign
 * of it working. It never shows a secret.
 */
function Check({
  ok,
  label,
  detail,
  icon,
}: {
  ok: boolean;
  label: string;
  detail?: ReactNode;
  icon: IconName;
}) {
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <IconTile name={icon} tone={ok ? "accent" : "error"} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail ? <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      <span
        className={
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium " +
          (ok ? "border-success/40 bg-success/10 text-success" : "border-error/40 bg-error/10 text-error")
        }
      >
        {ok ? "Connected" : "Needs attention"}
      </span>
    </li>
  );
}

export default async function AdminSettingsPage() {
  const context = await requirePermission("settings.read", "/admin/settings");
  const s = await systemStatus();

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Whether each service the site depends on is connected. Values are set in the hosting environment; changing one is a deployment, not a setting here."
      />

      <AdminSection title="Integrations">
        <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-surface shadow-card">
          <Check
            ok={Boolean(s.siteUrl)}
            icon="globe"
            label="Site address"
            detail={s.siteUrl ?? "NEXT_PUBLIC_SITE_URL is not set — links in emails will be wrong."}
          />
          <Check ok={Boolean(s.supabaseHost)} icon="database"
            label="Database and sign-in (Supabase)" detail={s.supabaseHost ?? "Not configured."} />
          <Check
            ok={s.stripe.configured}
            icon="card"
            label="Payments (Stripe)"
            detail={
              s.stripe.configured
                ? s.stripe.mode === "live"
                  ? "Live mode — real cards are charged."
                  : "Test mode — no real money moves."
                : "No Stripe key — checkout will fail."
            }
          />
          <Check
            ok={s.stripe.webhook}
            icon="plug"
            label="Stripe webhook"
            detail={
              s.stripe.webhook
                ? s.lastWebhookAt
                  ? `Last event processed ${ukDateTime(s.lastWebhookAt)}.`
                  : "Configured; no events received yet."
                : "No signing secret — paid orders will never be fulfilled."
            }
          />
          <Check
            ok={s.brevo}
            icon="mail"
            label="Email delivery (Brevo)"
            detail={
              s.brevo
                ? s.failedEmails > 0
                  ? `${s.failedEmails} email${s.failedEmails === 1 ? "" : "s"} failed — see Emails.`
                  : s.oldestPendingEmailAt
                    ? `Oldest queued email waiting since ${ukDateTime(s.oldestPendingEmailAt)}.`
                    : "Configured. Nothing waiting."
                : "No API key — emails are queued but never sent."
            }
          />
          <Check
            ok={s.cron}
            icon="clock"
            label="Scheduled jobs"
            detail={s.cron ? "Email sending, reminders and reconciliation run on a schedule." : "No CRON_SECRET — scheduled jobs are refused."}
          />
        </ul>
      </AdminSection>

      <AdminSection title="Where things are managed">
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            { href: "/admin/roles", icon: "shield" as IconName, label: "Roles and permissions", text: "What each staff role can do, and who holds it." },
            { href: "/admin/users", icon: "users" as IconName, label: "People", text: "Accounts, their access, roles and security keys." },
            { href: "/admin/emails", icon: "mail" as IconName, label: "Email outbox", text: "Every transactional email and its delivery." },
            ...(can(context, "audit.read")
              ? [{ href: "/admin/audit", icon: "history" as IconName, label: "Audit log", text: "Every privileged change, who made it and why." }]
              : []),
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex h-full items-start gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card transition-colors hover:border-accent/50"
              >
                <IconTile name={l.icon} tone="accent" />
                <span className="min-w-0">
                  <span className="font-medium">{l.label} <span aria-hidden="true">&rarr;</span></span>
                  <span className="mt-1 block text-sm text-muted-foreground">{l.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </AdminSection>
    </>
  );
}
