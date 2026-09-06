import type { Metadata } from "next";
import Link from "next/link";

import { InviteForm } from "@/app/admin/users/InviteForm";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { adminUsers } from "@/lib/admin";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Users · Admin", robots: { index: false } };

/**
 * Users — note 06 §14, §14.2.
 *
 * Search is a plain GET form, so a filtered list is a URL that can be shared,
 * bookmarked and reloaded, and it works before hydration. The page states which
 * fields it searches: email addresses live in `auth.users` and are not
 * searchable from here, and a box that quietly ignored the field most people
 * would type into would be worse than no box.
 */
export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  // The layout established staff; this establishes the specific permission.
  const context = await requirePermission("users.read", "/admin/users");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : undefined;
  const users = await adminUsers(query);

  return (
    <>
      <PageHeader
        title="Users"
        description={
          query
            ? `${users.length} matching “${query}”`
            : `${users.length} accounts`
        }
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <form method="get" role="search" className="flex flex-wrap gap-2">
          <label htmlFor="q" className="sr-only">
            Search by name
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query ?? ""}
            placeholder="Search by name"
            className="h-11 w-64 max-w-full rounded-(--radius) border border-border bg-background px-3 text-base"
          />
          <button
            type="submit"
            className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            Search
          </button>
          {query ? (
            <Link
              href="/admin/users"
              className="flex h-11 items-center px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {context.permissions.has("users.invite") ? <InviteForm /> : null}
      </div>

      <AdminTable
        headers={["Name", "Status", "Joined", ""]}
        empty={
          users.length === 0
            ? query
              ? `Nobody matches “${query}”. Names are searched, not email addresses.`
              : "No users yet."
            : undefined
        }
      >
        {users.map((u) => (
          <tr key={u.user_id} className="hover:bg-surface">
            <td className="px-4 py-3 font-medium">
              {u.display_name ??
                [u.first_name, u.last_name].filter(Boolean).join(" ") ??
                "—"}
            </td>
            <td className="px-4 py-3">
              <StatusPill value={u.status} />
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(u.created_at).toLocaleDateString("en-GB")}
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/users/${u.user_id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                View
              </Link>
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
