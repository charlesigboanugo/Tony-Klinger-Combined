import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, humanise, PersonCell, ukDate } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import { adminEntitlementDirectory, kindLabel } from "@/lib/admin/entitlement-products";
import { peopleByIds } from "@/lib/admin/operations";
import { applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { EntitlementChange } from "@/app/admin/entitlements/EntitlementChange";
import { can, requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Entitlements · Admin", robots: { index: false } };

/**
 * Who holds access to one thing — note 10 §33.2.
 *
 * Everybody entitled to one course, pass tier, cohort, event and so on, with
 * how they came by it. The product is found in the directory the index page
 * lists, so an address naming anything else is a 404 and nothing from the URL
 * reaches a query.
 */
export default async function AdminProductEntitlementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { type, id } = await params;
  const path = `/admin/entitlements/${type}/${id}`;
  const context = await requirePermission("entitlements.read", path);
  const canAdjust = can(context, "entitlements.adjust");
  const canRevoke = can(context, "entitlements.revoke");
  const search = await searchParams;
  const query = readQuery(search);

  const directory = await adminEntitlementDirectory();
  const product = directory.products.find((p) => p.type === type && p.id === id);
  if (!product) notFound();

  const mine = directory.entitlements.filter(
    (e) => e.resource_type === product.type && (e.resource_id ?? product.id) === product.id,
  );
  const people = await peopleByIds(mine.map((e) => e.user_id));

  const searched = searchRows(mine, query, (e) => [
    people.get(e.user_id)?.name,
    people.get(e.user_id)?.email,
    humanise(e.source_type),
    e.grant_reason,
    humanise(e.status),
  ]);
  const f = applyFilters(searched, search, [
    { key: "source", name: "Source", read: (e) => e.source_type, label: humanise },
    { key: "status", name: "Status", read: (e) => e.status, label: humanise },
  ]);
  const sort = readSort(search, ["person", "source", "status", "remaining", "granted"], query ? undefined : { key: "granted", dir: "desc" });
  const sorted = sortRows(f.rows, sort, {
    person: (e) => people.get(e.user_id)?.name ?? people.get(e.user_id)?.email,
    source: (e) => e.source_type,
    status: (e) => e.status,
    // Unlimited has no number to compare, so it goes last either way.
    remaining: (e) => (e.quantity == null ? null : e.quantity - e.quantity_used),
    granted: (e) => e.created_at,
  });
  const sortParams = search.sort ? { sort: sort?.key, dir: sort?.dir } : {};
  const carry = { q: query, ...sortParams, ...f.active };

  return (
    <>
      <BackLink href="/admin/entitlements">All products</BackLink>
      <AdminPageHeader
        title={product.name}
        meta={sorted.length < mine.length ? `${sorted.length} of ${mine.length}` : `${mine.length} granted`}
        description={`${kindLabel(product.type)}. ${product.active} hold it now.`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path={path}
          query={query}
          label="Name, email or reason"
          placeholder="Name, email or reason"
          keep={{ ...carry, q: undefined }}
        />
        <AdminSort
          path={path}
          state={sort}
          params={{ q: query, ...f.active }}
          unsorted={query ? { label: "Best match" } : undefined}
          options={[
            { label: "Newest granted", key: "granted", dir: "desc" },
            { label: "Oldest granted", key: "granted", dir: "asc" },
            { label: "Person A to Z", key: "person", dir: "asc" },
            { label: "Fewest remaining", key: "remaining", dir: "asc" },
            { label: "Status", key: "status", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path={path} {...c} params={carry} />
        ))}
      </div>

      <AdminTable
        headers={[
          { label: "Person", key: "person" },
          { label: "Source", key: "source" },
          { label: "Status", key: "status" },
          { label: "Remaining", key: "remaining" },
          "Reason",
          "Ends",
          { label: "Granted", key: "granted", first: "desc" },
          ...(canAdjust || canRevoke ? [""] : []),
        ]}
        sort={{ path, state: sort, params: { q: query, ...f.active } }}
        empty={
          sorted.length === 0
            ? mine.length === 0
              ? "Nobody holds this yet."
              : "Nobody matches. Set a filter back to Any to see more."
            : undefined
        }
      >
        {sorted.map((e) => (
          <tr key={e.id} className="hover:bg-surface-muted/60">
            <td className="px-4 py-3">
              <PersonCell id={e.user_id} name={people.get(e.user_id)?.name} email={people.get(e.user_id)?.email} />
            </td>
            <td className="px-4 py-3">{humanise(e.source_type)}</td>
            <td className="px-4 py-3"><StatusPill value={e.status} /></td>
            <td className="px-4 py-3">
              {e.quantity == null ? "Unlimited" : `${e.quantity - e.quantity_used}/${e.quantity}`}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{e.grant_reason ?? "—"}</td>
            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{e.expires_at ? ukDate(e.expires_at) : "No end date"}</td>
            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{ukDate(e.created_at)}</td>
            {canAdjust || canRevoke ? (
              <td className="px-4 py-3 text-right">
                <EntitlementChange
                  entitlement={e}
                  what={product.name}
                  person={people.get(e.user_id)?.name ?? people.get(e.user_id)?.email ?? "This person"}
                  canAdjust={canAdjust}
                  canRevoke={canRevoke}
                />
              </td>
            ) : null}
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
