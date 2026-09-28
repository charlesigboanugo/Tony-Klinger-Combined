import type { Metadata } from "next";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, FilterTabs, humanise, ukDateTime } from "@/components/admin/AdminUI";
import { EMAIL_STATUSES, adminEmails, isOneOf } from "@/lib/admin/operations";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Emails · Admin", robots: { index: false } };

/**
 * The email outbox — note 09 §47, migration 0015.
 *
 * Every transactional email is queued here first and sent by the scheduled
 * job through Brevo, with retries. This is where to look when somebody says
 * "I never got the email": whether it was queued, sent, or failed and why.
 */
export default async function AdminEmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  await requirePermission("emails.read", "/admin/emails");
  const params = await searchParams;
  const status = isOneOf(EMAIL_STATUSES, params.status) ? params.status : undefined;
  const { emails, counts } = await adminEmails(status);

  return (
    <>
      <AdminPageHeader
        title="Emails"
        meta={`${counts.all} queued in total`}
        description="Every transactional email — receipts, tickets, reminders — and whether it was delivered to Brevo. Failed ones show the reason."
      />

      <FilterTabs
        label="Filter emails by status"
        path="/admin/emails"
        param="status"
        current={status}
        options={[
          { value: undefined, label: "All", count: counts.all },
          ...EMAIL_STATUSES.map((s) => ({ value: s, label: humanise(s), count: counts[s] })),
        ]}
      />

      <AdminTable
        headers={["Queued", "To", "Email", "Status", "Detail"]}
        empty={emails.length === 0 ? "Nothing here." : undefined}
      >
        {emails.map((e) => (
          <tr key={e.id} className="align-top hover:bg-surface-muted/60">
            <td className="px-4 py-3 whitespace-nowrap">{ukDateTime(e.created_at)}</td>
            <td className="px-4 py-3">
              <span className="block max-w-64 truncate font-medium">{e.to_name ?? e.to_email}</span>
              {e.to_name ? <span className="block max-w-64 truncate text-xs text-muted-foreground">{e.to_email}</span> : null}
            </td>
            <td className="px-4 py-3">{humanise(e.template)}</td>
            <td className="px-4 py-3"><StatusPill value={e.status} /></td>
            <td className="max-w-80 px-4 py-3 text-xs text-muted-foreground">
              {e.status === "sent"
                ? `Sent ${ukDateTime(e.sent_at)}`
                : e.status === "failed"
                  ? <span className="text-error">{e.last_error ?? "Failed"} · {e.attempts} attempt{e.attempts === 1 ? "" : "s"}</span>
                  : e.status === "pending"
                    ? `${e.attempts ? `${e.attempts} attempt${e.attempts === 1 ? "" : "s"} · ` : ""}next try ${ukDateTime(e.next_attempt_at)}`
                    : "—"}
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
