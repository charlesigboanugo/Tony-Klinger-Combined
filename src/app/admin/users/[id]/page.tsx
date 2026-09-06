import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/ui/BackLink";
import { KeysForm } from "@/app/admin/users/[id]/KeysForm";
import { RoleForm } from "@/app/admin/users/[id]/RoleForm";
import { TeamForm } from "@/app/admin/users/[id]/TeamForm";
import {
  adminRoles,
  adminTeamMembership,
  adminUserDetail,
  adminUserFactors,
} from "@/lib/admin";
import { formatPrice } from "@/lib/commerce/pricing";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "User · Admin", robots: { index: false } };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  await requirePermission("users.read", `/admin/users/${id}`);

  const [detail, roles, team, keys] = await Promise.all([
    adminUserDetail(id),
    adminRoles(),
    adminTeamMembership(id),
    adminUserFactors(id),
  ]);
  if (!detail.profile) notFound();

  const name = (detail.profile.display_name as string | null) ?? "Unnamed account";

  return (
    <>
      <BackLink href="/admin/users">All users</BackLink>
      <div className="mt-6">
        <PageHeader
          title={name}
          description={detail.roles.length ? `Roles: ${detail.roles.join(", ")}` : "Customer"}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Entitlements</h2>
        <AdminTable
          headers={["Resource", "Source", "Status", "Remaining", "Reason"]}
          empty={detail.entitlements.length === 0 ? "No entitlements." : undefined}
        >
          {detail.entitlements.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 capitalize">{e.resource_type.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 capitalize">{e.source_type.replace(/_/g, " ")}</td>
              <td className="px-4 py-3"><StatusPill value={e.status} /></td>
              <td className="px-4 py-3">
                {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used}/${e.quantity}`}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.grant_reason ?? "—"}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Orders</h2>
        <AdminTable
          headers={["Date", "Total", "Status"]}
          empty={detail.orders.length === 0 ? "No orders." : undefined}
        >
          {detail.orders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString("en-GB")}</td>
              <td className="px-4 py-3">{formatPrice(o.total, o.currency)}</td>
              <td className="px-4 py-3"><StatusPill value={o.status} /></td>
            </tr>
          ))}
        </AdminTable>
      </section>

      {/* Role assignment lives here rather than on /admin/roles: a role is
          granted to a PERSON, and what they hold and have bought — the context
          for that decision — is on this page (note 06 §13.1). */}
      <section className="mt-10">
        <h2 className="mb-1 font-display text-lg font-semibold">Roles</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {detail.roles.length
            ? `Currently holds ${detail.roles.map((r) => r.replace(/_/g, " ")).join(", ")}.`
            : "This account holds no staff roles — it is a customer."}
        </p>
        <RoleForm
          userId={id}
          roles={roles.map((role) => role.name)}
          held={detail.roles}
        />
      </section>

      {/* The recovery lever note 05 §11.1 always assumed. It matters more now
          that a customer who registers a key is asked for it at sign-in:
          losing the key means losing the account until this is done. */}
      <section className="mt-10">
        <h2 className="mb-1 font-display text-lg font-semibold">
          Security keys
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          What this account signs in with, and how to hand it back if the key is
          lost.
        </p>
        <KeysForm userId={id} keys={keys} />
      </section>

      {/* Public presentation, deliberately separate from roles above — being on
          the team page grants nothing and holding a role shows nothing
          (note 06 §14.1). */}
      <section className="mt-10">
        <h2 className="mb-1 font-display text-lg font-semibold">
          Public team page
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Whether this person appears on /about/team. Separate from their roles.
        </p>
        <TeamForm
          userId={id}
          defaultName={name === "Unnamed account" ? "" : name}
          entry={team.entry}
          unlinked={team.unlinked}
        />
      </section>
    </>
  );
}
