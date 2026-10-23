import type { Metadata } from "next";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, humanise, PersonCell, ukDateTime } from "@/components/admin/AdminUI";
import { adminAuditLog } from "@/lib/admin";
import { peopleByIds } from "@/lib/admin/operations";
import { SEARCH_DEPTH, applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
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
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePermission("audit.read", "/admin/audit");
  const params = await searchParams;
  const query = readQuery(params);
  const loaded = await adminAuditLog(query ? SEARCH_DEPTH : 200);
  const people = await peopleByIds(loaded.map((e) => e.actor_user_id));
  // By who did it, what they did, what it touched, or the reason they gave.
  const entries = searchRows(loaded, query, (e) => [
    e.actor_user_id ? people.get(e.actor_user_id)?.name : "System",
    e.actor_user_id ? people.get(e.actor_user_id)?.email : null,
    humanise(e.action.replace(/\./g, " ")),
    e.resource_type ? humanise(e.resource_type) : null,
    e.reason,
    e.resource_id,
  ]);

  const sort = readSort(params, ["when", "who", "action", "affected"], query ? undefined : { key: "when", dir: "desc" });
  const actorName = (id: string | null) =>
    id ? (people.get(id)?.name ?? people.get(id)?.email ?? "Unknown") : "System";
  const f = applyFilters(entries, params, [
    { key: "who", name: "Who", read: (e) => actorName(e.actor_user_id) },
    { key: "action", name: "Action", read: (e) => e.action, label: (v) => humanise(v.replace(/\./g, " ")) },
    { key: "affected", name: "Affected", read: (e) => e.resource_type, label: humanise },
  ]);
  const sortParams = params.sort ? { sort: sort?.key, dir: sort?.dir } : {};
  const carry = { ...sortParams, ...f.active, q: query };
  const sortedEntries = sortRows(f.rows, sort, {
    when: (e) => e.created_at,
    who: (e) => (e.actor_user_id ? (people.get(e.actor_user_id)?.name ?? people.get(e.actor_user_id)?.email) : "System"),
    action: (e) => e.action,
    affected: (e) => e.resource_type,
  });

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        meta={query ? `${sortedEntries.length} matching` : `Latest ${entries.length}`}
        description="Every privileged change, who made it and the reason they gave. Entries are written by the database and cannot be edited."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/audit"
          query={query}
          label="Who, action or reason"
          placeholder="Who, action or reason"
          keep={{ ...carry, q: undefined }}
        />
        <AdminSort
          path="/admin/audit"
          state={sort}
          params={{ ...f.active, q: query }}
          unsorted={query ? { label: "Best match" } : undefined}
          options={[
            { label: "Newest first", key: "when", dir: "desc" },
            { label: "Oldest first", key: "when", dir: "asc" },
            { label: "Who A to Z", key: "who", dir: "asc" },
            { label: "Action", key: "action", dir: "asc" },
            { label: "Affected", key: "affected", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path="/admin/audit" {...c} params={carry} />
        ))}
      </div>

      <AdminTable
        headers={[
          { label: "When", key: "when", first: "desc" },
          { label: "Who", key: "who" },
          { label: "Action", key: "action" },
          { label: "Affected", key: "affected" },
          "Reason",
        ]}
        sort={{ path: "/admin/audit", state: sort, params: { ...f.active, q: query } }}
        empty={sortedEntries.length === 0 ? (query ? `Nothing matches “${query}”.` : "Nothing recorded yet.") : undefined}
      >
        {sortedEntries.map((e) => {
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
