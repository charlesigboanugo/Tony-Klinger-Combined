import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import Link from "next/link";

import { AdminPageHeader, AdminSection, humanise, ukDate } from "@/components/admin/AdminUI";
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
import { peopleByIds } from "@/lib/admin/operations";
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
  const email = (await peopleByIds([id])).get(id)?.email ?? null;

  return (
    <>
      <BackLink href="/admin/users">All users</BackLink>
      <AdminPageHeader
        title={name}
        meta={detail.roles.length ? detail.roles.map(humanise).join(", ") : "Customer"}
        description={
          email ? (
            <a href={`mailto:${email}`} className="underline-offset-4 hover:text-accent hover:underline">
              {email}
            </a>
          ) : undefined
        }
      />

      <AdminSection title="Access" description="What this person can use, and why.">
        <AdminTable
          headers={["Resource", "Source", "Status", "Remaining", "Reason"]}
          empty={detail.entitlements.length === 0 ? "No entitlements." : undefined}
        >
          {detail.entitlements.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3">{humanise(e.resource_type)}</td>
              <td className="px-4 py-3">{humanise(e.source_type)}</td>
              <td className="px-4 py-3"><StatusPill value={e.status} /></td>
              <td className="px-4 py-3 tabular-nums">
                {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used} of ${e.quantity}`}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.grant_reason ?? "—"}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>

      <AdminSection title="Orders">
        <AdminTable
          headers={["Placed", "Total", "Status", ""]}
          empty={detail.orders.length === 0 ? "No orders." : undefined}
        >
          {detail.orders.map((o) => (
            <tr key={o.id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-3">{ukDate(o.created_at)}</td>
              <td className="px-4 py-3 tabular-nums">{formatPrice(o.total, o.currency)}</td>
              <td className="px-4 py-3"><StatusPill value={o.status} /></td>
              <td className="px-4 py-3 text-right">
                <Link href={`/admin/orders/${o.id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>

      {/* Role assignment lives here rather than on /admin/roles: a role is
          granted to a PERSON, and what they hold and have bought — the context
          for that decision — is on this page (note 06 §13.1). */}
      <AdminSection
        title="Roles"
        description={
          detail.roles.length
            ? `Currently holds ${detail.roles.map((r) => r.replace(/_/g, " ")).join(", ")}.`
            : "This account holds no staff roles — it is a customer."
        }
      >
        <RoleForm
          userId={id}
          roles={roles.map((role) => role.name)}
          held={detail.roles}
        />
      </AdminSection>

      {/* The recovery lever note 05 §11.1 always assumed. It matters more now
          that a customer who registers a key is asked for it at sign-in:
          losing the key means losing the account until this is done. */}
      <AdminSection
        title="Security keys"
        description="What this account signs in with, and how to hand it back if the key is lost."
      >
        <KeysForm userId={id} keys={keys} />
      </AdminSection>

      {/* Public presentation, deliberately separate from roles above — being on
          the team page grants nothing and holding a role shows nothing
          (note 06 §14.1). */}
      <AdminSection
        title="Team listing"
        description="Whether this person appears in the Team list. Separate from their roles."
      >
        <TeamForm
          userId={id}
          defaultName={name === "Unnamed account" ? "" : name}
          entry={team.entry}
          unlinked={team.unlinked}
        />
      </AdminSection>
    </>
  );
}
