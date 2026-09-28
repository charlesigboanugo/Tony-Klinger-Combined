import type { Metadata } from "next";
import Link from "next/link";

import { InviteForm } from "@/app/admin/users/InviteForm";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, humanise, ukDate } from "@/components/admin/AdminUI";
import { adminUsers } from "@/lib/admin";
import { peopleByIds, rolesByUser } from "@/lib/admin/operations";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Users · Admin", robots: { index: false } };

/**
 * Users — note 06 §14, §14.2.
 *
 * Search is a plain GET form, so a filtered list is a URL that can be shared,
 * bookmarked and reloaded, and it works before hydration. The page states which
 * fields it searches: email addresses live in `auth.users` and are not
 * searchable from here, and a box that quietly ignored the field most people
 * would type into would be worse than no box. Emails are SHOWN, read per row.
 */
export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  // The layout established staff; this establishes the specific permission.
  const context = await requirePermission("users.read", "/admin/users");

  const params = await searchParams;
  const query = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const users = await adminUsers(query);
  const ids = users.map((u) => u.user_id);
  const [people, roles] = await Promise.all([peopleByIds(ids), rolesByUser(ids)]);

  return (
    <>
      <AdminPageHeader
        title="Users"
        meta={query ? `${users.length} matching` : `${users.length} accounts`}
        description="Everyone with an account — customers and staff. Open a person to see their access, orders, roles and security keys."
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <AdminSearch path="/admin/users" query={query} label="Search by name" placeholder="Search by name" />
        {context.permissions.has("users.invite") ? <InviteForm /> : null}
      </div>

      <AdminTable
        headers={["Person", "Roles", "Status", "Joined", ""]}
        empty={
          users.length === 0
            ? query
              ? `Nobody matches “${query}”. Names are searched, not email addresses.`
              : "No users yet."
            : undefined
        }
      >
        {users.map((u) => {
          const name =
            u.display_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || null;
          const email = people.get(u.user_id)?.email;
          const held = roles.get(u.user_id) ?? [];
          return (
            <tr key={u.user_id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-3">
                <Link href={`/admin/users/${u.user_id}`} className="block max-w-72 hover:text-accent">
                  <span className="block truncate font-medium">{name ?? email ?? "Unnamed account"}</span>
                  {name && email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
                </Link>
              </td>
              <td className="px-4 py-3">
                {held.length ? (
                  <span className="flex flex-wrap gap-1">
                    {held.map((r) => (
                      <span key={r} className="rounded-full bg-block-indigo/10 px-2 py-0.5 text-xs font-medium text-block-indigo dark:bg-block-indigo/40 dark:text-foreground">
                        {humanise(r)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Customer</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusPill value={u.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{ukDate(u.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/users/${u.user_id}`}
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  Open
                </Link>
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </>
  );
}
