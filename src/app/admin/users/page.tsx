import type { Metadata } from "next";
import Link from "next/link";

import { InviteForm } from "@/app/admin/users/InviteForm";
import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, humanise, ukDate, ukDateTime } from "@/components/admin/AdminUI";
import { adminUserDirectory, type AdminUserRow } from "@/lib/admin";
import { applyFilters, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Users · Admin", robots: { index: false } };

/**
 * Users — note 06 §14, §14.2.
 *
 * Search is a plain GET form, so a filtered list is a URL that can be shared,
 * bookmarked and reloaded, and it works before hydration.
 *
 * IT SEARCHES WHAT THE PAGE SHOWS (owner, 2026-10-13): name, email address,
 * role ("admin", "customer", "staff") and status. It used to search names
 * only, because emails live in `auth.users`; `adminUserDirectory` now reads
 * every account in three requests, so the page searches, narrows and sorts
 * across everybody and is quicker than the hundred per-row lookups it made
 * before. Only the first `SHOWN` matches are drawn.
 *
 * "Last sign-in" (owner, 2026-10-13) is how long ago the account last signed
 * in, in words, with the exact time on hover. It is the last SIGN-IN, not the
 * last visit: somebody who stays signed in for weeks shows the day they
 * signed in. With no search the list opens on it, latest first; a search
 * opens on the closest matches.
 */
/** Rows drawn at once. The search and filters still run over everybody. */
const SHOWN = 200;

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  // The layout established staff; this establishes the specific permission.
  const context = await requirePermission("users.read", "/admin/users");

  const params = await searchParams;
  const query = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const { users: everyone, complete } = await adminUserDirectory();

  const nameOf = (u: AdminUserRow) =>
    u.display_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
  // What a person can be found by, most telling first. "staff" finds anyone
  // holding a staff role; "customer" everyone else, including an Academy
  // viewer, whose role is not staff (migration 0019).
  const listed = searchRows(everyone, query, (u) => [
    nameOf(u),
    u.email,
    `${u.roles.map(humanise).join(" ")} ${u.staff ? "staff" : "customer"}`.trim(),
    humanise(u.status),
  ]);

  const sort = readSort(
    params,
    ["person", "roles", "signin", "status", "joined"],
    query ? undefined : { key: "signin", dir: "desc" },
  );
  const f = applyFilters(listed, params, [
    {
      key: "role",
      name: "Role",
      // Somebody with no staff role is a customer, which is a choice too.
      read: (u) => (u.roles.length ? u.roles : ["customer"]),
      label: humanise,
    },
    { key: "status", name: "Status", read: (u) => u.status, label: humanise },
  ]);
  const sortParams = params.sort ? { sort: sort?.key, dir: sort?.dir } : {};
  const carry = { q: query, ...sortParams, ...f.active };
  // `listed` is already closest-first; a chosen sort replaces that order.
  const matching = sortRows(f.rows, sort, {
    person: nameOf,
    roles: (u) => u.roles.join(", "),
    signin: (u) => u.lastSignInAt,
    status: (u) => u.status,
    joined: (u) => u.created_at,
  });
  const users = matching.slice(0, SHOWN);

  return (
    <>
      {params.deleted === "1" ? (
        <p role="status" className="mb-5 rounded-(--radius) border border-success bg-success/10 px-3 py-2 text-sm text-success">
          The account was deleted. The deletion and its reason are in the audit log.
        </p>
      ) : null}
      <AdminPageHeader
        title="Users"
        meta={matching.length < everyone.length ? `${matching.length} of ${everyone.length}` : `${everyone.length} accounts`}
        description="Everyone with an account — customers and staff. Open a person to see their access, orders, roles and two-step verification."
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/users"
          query={query}
          label="Search by name, email or role"
          placeholder="Name, email or role"
          keep={{ ...sortParams, ...f.active }}
        />
        <AdminSort
          path="/admin/users"
          state={sort}
          params={{ q: query, ...f.active }}
          unsorted={query ? { label: "Best match" } : undefined}
          options={[
            { label: "Latest sign-in", key: "signin", dir: "desc" },
            { label: "Name A to Z", key: "person", dir: "asc" },
            { label: "Newest account", key: "joined", dir: "desc" },
            { label: "Oldest account", key: "joined", dir: "asc" },
            { label: "Staff first", key: "roles", dir: "asc" },
            { label: "Status", key: "status", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path="/admin/users" {...c} params={carry} />
        ))}
        </div>
        {context.permissions.has("users.invite") ? <InviteForm /> : null}
      </div>

      <AdminTable
        headers={[
          { label: "Person", key: "person" },
          { label: "Roles", key: "roles" },
          { label: "Last sign-in", key: "signin", first: "desc" },
          { label: "Status", key: "status" },
          { label: "Joined", key: "joined", first: "desc" },
          "",
        ]}
        sort={{ path: "/admin/users", state: sort, params: { q: query, ...f.active } }}
        empty={
          users.length === 0
            ? listed.length > 0
              ? "Nobody matches. Set a filter back to Any to see more."
              : query
                ? `Nobody matches “${query}”. Search looks at names, email addresses, roles and status.`
                : "No users yet."
            : undefined
        }
      >
        {users.map((u) => {
          const name =
            u.display_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || null;
          const email = u.email;
          const lastSignIn = u.lastSignInAgo;
          const held = u.roles;
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
              <td className="px-4 py-3 whitespace-nowrap">
                {lastSignIn ? (
                  <time dateTime={u.lastSignInAt ?? undefined} title={ukDateTime(u.lastSignInAt)}>
                    {lastSignIn}
                  </time>
                ) : (
                  <span className="text-muted-foreground">Never</span>
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

      {matching.length > users.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing the first {users.length} of {matching.length}. Search or narrow the list to find the rest.
        </p>
      ) : null}
      {complete ? null : (
        <p className="mt-3 text-sm text-warning">
          There are more accounts than this page reads at once, so the oldest are not searched here.
        </p>
      )}
    </>
  );
}
