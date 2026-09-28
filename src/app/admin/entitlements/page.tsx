import type { Metadata } from "next";

import { GrantForm } from "@/app/admin/entitlements/GrantForm";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSection, PersonCell, humanise, ukDate } from "@/components/admin/AdminUI";
import { adminEntitlements } from "@/lib/admin";
import { peopleByIds } from "@/lib/admin/operations";
import { can, requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Entitlements · Admin", robots: { index: false } };

/**
 * Entitlement administration — R18, note 06 §23.1.
 *
 * Granting hands a customer paid access without payment, so this area is
 * owner/admin level and every change is audited.
 */
export default async function AdminEntitlementsPage() {
  const context = await requirePermission("entitlements.read", "/admin/entitlements");
  const entitlements = await adminEntitlements();
  const people = await peopleByIds(entitlements.map((e) => e.user_id));

  return (
    <>
      <AdminPageHeader
        title="Entitlements"
        meta={`${entitlements.length} shown`}
        description="What customers can access, and why. Every change here is audited."
      />

      {can(context, "entitlements.grant") ? (
        <AdminSection
          title="Grant access by hand"
          description="For comps, corrections and partners. The reason is recorded in the audit log."
          className="mb-10"
        >
          <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
            <GrantForm />
          </div>
        </AdminSection>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          Your role can view entitlements but not grant them.
        </p>
      )}

      <AdminTable
        headers={["Person", "Resource", "Source", "Status", "Remaining", "Reason", "Granted"]}
        empty={entitlements.length === 0 ? "No entitlements yet." : undefined}
      >
        {entitlements.map((e) => (
          <tr key={e.id} className="hover:bg-surface-muted/60">
            <td className="px-4 py-3">
              <PersonCell id={e.user_id} name={people.get(e.user_id)?.name} email={people.get(e.user_id)?.email} />
            </td>
            <td className="px-4 py-3">{humanise(e.resource_type)}</td>
            <td className="px-4 py-3">{humanise(e.source_type)}</td>
            <td className="px-4 py-3"><StatusPill value={e.status} /></td>
            <td className="px-4 py-3">
              {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used}/${e.quantity}`}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{e.grant_reason ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {ukDate(e.created_at)}
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
