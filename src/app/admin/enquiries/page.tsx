import type { Metadata } from "next";

import { setEnquiryStatusAction } from "@/app/admin/enquiries/actions";
import { StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, FilterTabs, humanise, ukDateTime } from "@/components/admin/AdminUI";
import { EmptyState } from "@/components/ui/EmptyState";
import { can, requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Enquiries · Admin", robots: { index: false } };

const STATUSES = ["new", "read", "replied", "spam"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Contact-form enquiries — migration 0005, note 03 §8.
 *
 * The form has saved every message since launch, but nothing in Admin showed
 * them. Read through the operator's own session: RLS allows `users.read` to
 * read and `users.update` to change status, so this page needs no service role.
 */
export default async function AdminEnquiriesPage({ searchParams }: PageProps<"/admin/enquiries">) {
  const context = await requirePermission("users.read", "/admin/enquiries");
  const mayUpdate = can(context, "users.update");
  const params = await searchParams;
  const status: Status | undefined = STATUSES.includes(params.status as Status) ? (params.status as Status) : undefined;

  const supabase = await createClient();
  let request = supabase
    .from("contact_messages")
    .select("id,name,email,subject,message,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) request = request.eq("status", status);

  const [{ data }, ...tallies] = await Promise.all([
    request,
    ...STATUSES.map((s) =>
      supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("status", s),
    ),
  ]);
  const messages = data ?? [];
  const counts = Object.fromEntries(STATUSES.map((s, i) => [s, tallies[i].count ?? 0])) as Record<Status, number>;
  const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);

  return (
    <>
      <AdminPageHeader
        title="Enquiries"
        meta={`${counts.new} new`}
        description="Messages sent through the contact form. Reply by email, then mark them so nothing is answered twice or missed."
      />

      <FilterTabs
        label="Filter enquiries by status"
        path="/admin/enquiries"
        param="status"
        current={status}
        options={[
          { value: undefined, label: "All", count: total },
          ...STATUSES.map((s) => ({ value: s, label: humanise(s), count: counts[s] })),
        ]}
      />

      {messages.length === 0 ? (
        <EmptyState icon="mail"
          title={status ? `No ${status} enquiries` : "No enquiries yet"}
          description="Messages from the contact form appear here as they arrive."
        />
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                "rounded-(--radius-lg) border bg-surface shadow-card " +
                (m.status === "new" ? "border-accent/40" : "border-border")
              }
            >
              <details className="group" open={m.status === "new"}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.subject || "No subject"}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {m.name} · {m.email}
                    </span>
                  </span>
                  <span className="text-xs whitespace-nowrap text-muted-foreground">{ukDateTime(m.created_at)}</span>
                  <StatusPill value={m.status} />
                </summary>
                <div className="border-t border-border px-4 pt-4 pb-5 sm:px-5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "Your enquiry"}`)}`}
                      className="inline-flex h-9 items-center rounded-full bg-button px-4 text-sm font-medium text-button-foreground shadow-card"
                    >
                      Reply by email
                    </a>
                    {mayUpdate
                      ? STATUSES.filter((s) => s !== m.status).map((s) => (
                          <form key={s} action={setEnquiryStatusAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="status" value={s} />
                            <button
                              type="submit"
                              className="inline-flex h-9 items-center rounded-full border border-input-border px-4 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                            >
                              Mark {s === "new" ? "unread" : s}
                            </button>
                          </form>
                        ))
                      : null}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
