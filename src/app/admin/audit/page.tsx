import type { Metadata } from "next";

import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPageHeader, PersonCell, humanise, ukDateTime } from "@/components/admin/AdminUI";
import { adminAuditLog } from "@/lib/admin";
import { peopleByIds } from "@/lib/admin/operations";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Audit log · Admin", robots: { index: false } };

/**
 * The audit log — note 06 §31.
 *
 * Every privileged change (roles granted, access granted or revoked, invites,
 * security-key resets) is written by the database function that made it, with
 * who did it and why. Read-only: an audit trail that can be edited from the
 * interface it audits is not one.
 */
export default async function AdminAuditPage() {
  await requirePermission("audit.read", "/admin/audit");
  const entries = await adminAuditLog(200);
  const people = await peopleByIds(entries.map((e) => e.actor_user_id));

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        meta={`Latest ${entries.length}`}
        description="Every privileged change, who made it and the reason they gave. Entries are written by the database and cannot be edited."
      />

      <AdminTable
        headers={["When", "Who", "Action", "Affected", "Reason"]}
        empty={entries.length === 0 ? "Nothing recorded yet." : undefined}
      >
        {entries.map((e) => {
          const actor = e.actor_user_id ? people.get(e.actor_user_id) : undefined;
          return (
            <tr key={e.id} className="align-top hover:bg-surface-muted/60">
              <td className="px-4 py-3 whitespace-nowrap">{ukDateTime(e.created_at)}</td>
              <td className="px-4 py-3">
                <PersonCell id={e.actor_user_id} name={actor?.name} email={actor?.email} fallback="System" />
              </td>
              <td className="px-4 py-3 font-medium">{humanise(e.action.replace(/\./g, " "))}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {e.resource_type ? humanise(e.resource_type) : "—"}
                {e.resource_id ? (
                  <span className="block font-mono text-xs">{e.resource_id.slice(0, 8)}…</span>
                ) : null}
              </td>
              <td className="max-w-80 px-4 py-3 text-muted-foreground">{e.reason ?? "—"}</td>
            </tr>
          );
        })}
      </AdminTable>
    </>
  );
}
