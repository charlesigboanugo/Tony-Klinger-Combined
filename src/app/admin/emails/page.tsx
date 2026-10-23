import type { Metadata } from "next";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, FilterTabs, humanise, ukDateTime } from "@/components/admin/AdminUI";
import { EMAIL_STATUSES, adminEmails, isOneOf } from "@/lib/admin/operations";
import { SEARCH_DEPTH, applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
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
  const query = readQuery(params);
  const { emails: loaded, counts } = await adminEmails(status, query ? SEARCH_DEPTH : undefined);
  // By who it went to, which email it was, or why it failed.
  const emails = searchRows(loaded, query, (e) => [
    e.to_name,
    e.to_email,
    humanise(e.template),
    humanise(e.status),
    e.last_error,
  ]);

  const sort = readSort(params, ["queued", "to", "email", "status"]);
  const f = applyFilters(emails, params, [
    { key: "email", name: "Email", read: (e) => e.template, label: humanise },
  ]);
  const carry = { status, sort: sort?.key, dir: sort?.dir, ...f.active, q: query };
  const sortedEmails = sortRows(f.rows, sort, {
    queued: (e) => e.created_at,
    to: (e) => e.to_name ?? e.to_email,
    email: (e) => e.template,
    status: (e) => e.status,
  });

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
        keep={{ sort: sort?.key, dir: sort?.dir, ...f.active, q: query }}
        options={[
          { value: undefined, label: "All", count: counts.all },
          ...EMAIL_STATUSES.map((s) => ({ value: s, label: humanise(s), count: counts[s] })),
        ]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/emails"
          query={query}
          label="Recipient name, email address or email type"
          placeholder="Recipient name, email address or email type"
          keep={{ ...carry, q: undefined }}
        />
        <AdminSort
          path="/admin/emails"
          state={sort}
          params={{ status, ...f.active, q: query }}
          unsorted={{ label: query ? "Best match" : "Default order" }}
          options={[
            { label: "Newest first", key: "queued", dir: "desc" },
            { label: "Oldest first", key: "queued", dir: "asc" },
            { label: "Recipient A to Z", key: "to", dir: "asc" },
            { label: "Email type", key: "email", dir: "asc" },
            { label: "Status", key: "status", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path="/admin/emails" {...c} params={carry} />
        ))}
      </div>

      <AdminTable
        headers={[
          { label: "Queued", key: "queued", first: "desc" },
          { label: "To", key: "to" },
          { label: "Email", key: "email" },
          { label: "Status", key: "status" },
          "Detail",
        ]}
        sort={{ path: "/admin/emails", state: sort, params: { status, ...f.active, q: query } }}
        empty={sortedEmails.length === 0 ? (query ? `No emails match “${query}”.` : "Nothing here.") : undefined}
      >
        {sortedEmails.map((e) => (
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
