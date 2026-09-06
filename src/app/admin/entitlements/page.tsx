import type { Metadata } from "next";

import { GrantForm } from "@/app/admin/entitlements/GrantForm";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { adminEntitlements } from "@/lib/admin";
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

  return (
    <>
      <PageHeader
        title="Entitlements"
        description="What customers can access, and why. Every change here is audited."
      />

      {can(context, "entitlements.grant") ? (
        <section className="mb-10">
          <h2 className="mb-3 font-medium">Grant access by hand</h2>
          <GrantForm />
        </section>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          Your role can view entitlements but not grant them.
        </p>
      )}

      <AdminTable
        headers={["Resource", "Source", "Status", "Remaining", "Reason", "Granted"]}
        empty={entitlements.length === 0 ? "No entitlements yet." : undefined}
      >
        {entitlements.map((e) => (
          <tr key={e.id} className="hover:bg-surface">
            <td className="px-4 py-3 capitalize">{e.resource_type.replace(/_/g, " ")}</td>
            <td className="px-4 py-3 capitalize">{e.source_type.replace(/_/g, " ")}</td>
            <td className="px-4 py-3"><StatusPill value={e.status} /></td>
            <td className="px-4 py-3">
              {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used}/${e.quantity}`}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{e.grant_reason ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(e.created_at).toLocaleDateString("en-GB")}
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
