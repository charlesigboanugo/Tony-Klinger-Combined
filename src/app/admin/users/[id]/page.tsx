import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import Link from "next/link";

import { AdminPageHeader, AdminSection, humanise, ukDate } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import { KeysForm } from "@/app/admin/users/[id]/KeysForm";
import { RoleForm } from "@/app/admin/users/[id]/RoleForm";
import { TeamForm } from "@/app/admin/users/[id]/TeamForm";
import { DeleteUserForm } from "@/app/admin/users/[id]/DeleteUserForm";
import { EntitlementChange } from "@/app/admin/entitlements/EntitlementChange";
import {
  adminRoles,
  adminTeamMembership,
  adminUserDetail,
  adminUserFactors,
} from "@/lib/admin";
import { accessNames, kindLabel } from "@/lib/admin/entitlement-products";
import { accountDeletionBlockers, peopleByIds } from "@/lib/admin/operations";
import { formatPrice } from "@/lib/commerce/pricing";
import { can, requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "User · Admin", robots: { index: false } };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const context = await requirePermission("users.read", `/admin/users/${id}`);

  const [detail, roles, team, keys] = await Promise.all([
    adminUserDetail(id),
    adminRoles(),
    adminTeamMembership(id),
    adminUserFactors(id),
  ]);
  if (!detail.profile) notFound();

  const name = (detail.profile.display_name as string | null) ?? "Unnamed account";
  const email = (await peopleByIds([id])).get(id)?.email ?? null;
  // Only worked out for someone who may delete accounts; others never see it.
  const mayDelete = context.permissions.has("users.delete") && context.userId !== id;
  const blockers = mayDelete ? await accountDeletionBlockers(id) : [];
  const canAdjust = can(context, "entitlements.adjust");
  const canRevoke = can(context, "entitlements.revoke");
  const names = await accessNames(detail.entitlements);

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
          headers={["Access to", "Source", "Status", "Remaining", "Reason", ...(canAdjust || canRevoke ? [""] : [])]}
          empty={detail.entitlements.length === 0 ? "No entitlements." : undefined}
        >
          {detail.entitlements.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3">
                <span className="font-medium">{names.get(e.id)}</span>
                <span className="block text-xs text-muted-foreground">{kindLabel(e.resource_type)}</span>
              </td>
              <td className="px-4 py-3">{humanise(e.source_type)}</td>
              <td className="px-4 py-3"><StatusPill value={e.status} /></td>
              <td className="px-4 py-3 tabular-nums">
                {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used} of ${e.quantity}`}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.grant_reason ?? "—"}</td>
              {canAdjust || canRevoke ? (
                <td className="px-4 py-3 text-right">
                  <EntitlementChange
                    entitlement={e}
                    what={names.get(e.id) ?? kindLabel(e.resource_type)}
                    person={name}
                    canAdjust={canAdjust}
                    canRevoke={canRevoke}
                  />
                </td>
              ) : null}
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
        // The list itself shows what they hold, so this says how to change it.
        description="Add or remove roles in the list, then save. A person can hold several."
      >
        <RoleForm
          // Started afresh from the saved roles after every save.
          key={detail.roles.join(",")}
          userId={id}
          roles={roles.map((role) => ({ name: role.name, description: role.description }))}
          held={detail.roles}
          // Admins manage roles too since migration 0020, all but owner, which
          // only an owner grants or removes (note 06 §34).
          ownerRoleLocked={!context.roles.includes("owner")}
        />
      </AdminSection>

      {/* The recovery lever note 05 §11.1 always assumed. It matters more now
          that a customer who registers a key is asked for it at sign-in:
          losing the key means losing the account until this is done. */}
      <AdminSection
        title="Two-step verification"
        description="The security keys and authenticator apps this account signs in with, and how to hand it back if one is lost."
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

      {mayDelete ? (
        <AdminSection
          title="Delete account"
          description="Permanent. Only possible once nothing on the account is still live."
        >
          <DeleteUserForm userId={id} email={email} blockers={blockers} />
        </AdminSection>
      ) : null}
    </>
  );
}
