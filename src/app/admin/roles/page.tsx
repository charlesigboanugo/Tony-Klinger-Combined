import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader, humanise } from "@/components/admin/AdminUI";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminRoles } from "@/lib/admin";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Roles · Admin", robots: { index: false } };

/**
 * Roles — note 06 §7, §10, §39.
 *
 * This page was permission-checked and otherwise empty. It now answers the two
 * questions it exists for: what does each role ALLOW, and who currently HOLDS
 * it. Both come from `roles`, `role_permissions` and `user_roles`, so a role
 * added in a migration appears here without a code change — note 06 §7 is
 * explicit that role names must not be scattered through application code.
 *
 * Assignment itself stays on the USER, at /admin/users/[id], because that is
 * where the decision is actually made: you grant a role to a person, not a
 * person to a role. Note 06 §13 requires it to be a trusted server-side
 * operation with an audit entry, which `admin_set_role` provides.
 */
export default async function RolesPage() {
  await requirePermission("roles.read", "/admin/roles");
  const roles = await adminRoles();

  return (
    <>
      <AdminPageHeader
        title="Roles"
        meta={`${roles.length} roles`}
        description="What each role allows, and who holds it. Assign a role from a person's own page."
      />

      {roles.length === 0 ? (
        <EmptyState icon="users"
          title="No roles defined"
          description="Roles are created in migrations, not here."
        />
      ) : (
        <ul className="space-y-5">
          {roles.map((role) => (
            <li
              key={role.id}
              className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg">{humanise(role.name)}</h2>
                  {role.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium">
                  {role.holders.length}{" "}
                  {role.holders.length === 1 ? "person" : "people"}
                </span>
              </div>

              <div className="mt-4 grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
                    Holders
                  </h3>
                  {role.holders.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nobody holds this role.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {role.holders.map((holder) => (
                        <li key={holder.userId}>
                          <Link
                            href={`/admin/users/${holder.userId}`}
                            className="font-medium hover:text-accent"
                          >
                            {holder.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
                    Permissions ({role.permissions.length})
                  </h3>
                  {role.permissions.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      None granted.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {role.permissions.map((permission) => (
                        <li
                          key={permission}
                          className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 font-mono text-xs"
                        >
                          {permission}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        Roles are defined in migrations so the permission matrix lives in one
        place (note 06 §39). Granting one to a person is done from their own
        page, is checked server-side, and writes an audit entry (note 06 §13,
        §31).
      </p>
    </>
  );
}
