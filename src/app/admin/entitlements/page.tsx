import type { Metadata } from "next";
import Link from "next/link";

import { GrantForm } from "@/app/admin/entitlements/GrantForm";
import { AdminReveal } from "@/components/admin/AdminReveal";
import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminGroupSection } from "@/components/admin/AdminGroupSection";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch } from "@/components/admin/AdminUI";
import { adminEntitlementDirectory, grantOptions, kindLabel } from "@/lib/admin/entitlement-products";
import { applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { can, requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Entitlements · Admin", robots: { index: false } };

/**
 * Entitlements, by what the access is for — R18, note 06 §23.1, note 10 §33.2.
 *
 * THE PRODUCTS FIRST (owner, 2026-10-13), as on Bookings: access comes from
 * courses, passes, cohorts, events and more, and one list of every grant mixed
 * them all. This page lists what people have access TO, each with how many
 * hold it; opening one shows its holders. The by-product view is the whole
 * page (owner, 2026-10-15): the "All entitlements" button is gone, and one
 * customer's access is on their page under Users.
 *
 * Granting hands a customer paid access without payment, so this area is
 * owner/admin level and every change is audited.
 */
export default async function AdminEntitlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("entitlements.read", "/admin/entitlements");
  const params = await searchParams;
  const query = readQuery(params);

  const { products, entitlements, complete } = await adminEntitlementDirectory();

  const searched = searchRows(products, query, (p) => [p.name, kindLabel(p.type)]);
  const f = applyFilters(searched, params, [{ key: "kind", name: "Kind", read: (p) => p.type, label: kindLabel }]);
  const sort = readSort(params, ["name", "active", "total"]);
  const sorted = sortRows(f.rows, sort, { name: (p) => p.name, active: (p) => p.active, total: (p) => p.total });
  const carry = { q: query, sort: sort?.key, dir: sort?.dir, ...f.active };
  const kinds = [...new Set(sorted.map((p) => p.type))];

  return (
    <>
      <AdminPageHeader
        title="Entitlements"
        meta={`${entitlements.length} in total`}
        description="What customers can access, and why. Everything that can be held is listed, held or not. Pick one to see who holds it. Every change here is audited."
      />

      {/* The list first; granting is a button that opens the form. */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch
            path="/admin/entitlements"
            query={query}
            label="Find a course, pass, cohort or event"
            placeholder="Find a course, pass, cohort or event"
            keep={{ ...carry, q: undefined }}
          />
          <AdminSort
            path="/admin/entitlements"
            state={sort}
            params={{ q: query, ...f.active }}
            unsorted={{ label: query ? "Best match" : "By kind" }}
            options={[
              { label: "Most holders", key: "active", dir: "desc" },
              { label: "Most granted", key: "total", dir: "desc" },
              { label: "Name A to Z", key: "name", dir: "asc" },
            ]}
          />
          {f.controls.map((c) => (
            <AdminFilter key={c.param} path="/admin/entitlements" {...c} params={carry} />
          ))}
        </div>
        {can(context, "entitlements.grant") ? (
          <AdminReveal
            label="Grant access by hand"
            title="Grant access by hand"
            description="For comps, corrections and partners. The reason is recorded in the audit log."
          >
            <GrantForm groups={await grantOptions()} />
          </AdminReveal>
        ) : (
          <p className="self-center text-sm text-muted-foreground">Your role can view entitlements but not grant them.</p>
        )}
      </div>

      <AdminTable
        headers={[
          { label: "Access to", key: "name" },
          { label: "Hold it now", key: "active", first: "desc" },
          { label: "Ever granted", key: "total", first: "desc" },
          "",
        ]}
        sort={{ path: "/admin/entitlements", state: sort, params: { q: query, ...f.active } }}
        empty={sorted.length === 0 ? (query ? `Nothing matches “${query}”.` : "No entitlements yet.") : undefined}
        sectioned
      >
        {/* Under a heading per kind, unless a sort or a search has put them in
            an order of its own. */}
        {(sort || query ? [null] : kinds).map((kind) => {
          const rows = kind ? sorted.filter((p) => p.type === kind) : sorted;
          return (
            kind ? (
              <AdminGroupSection key={kind} label={kindLabel(kind)} count={rows.length} colSpan={4}>
              {rows.map((p) => {
                const href = `/admin/entitlements/${p.type}/${p.id}`;
                return (
                  <tr key={`${p.type}:${p.id}`} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <Link href={href} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      {kind ? null : <span className="block text-xs text-muted-foreground">{kindLabel(p.type)}</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.active > 0 ? p.active : <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.total > 0 ? p.total : <span className="text-muted-foreground">None yet</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={href} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
              </AdminGroupSection>
            ) : (
              <tbody key="all" className="divide-y divide-border">
              {rows.map((p) => {
                const href = `/admin/entitlements/${p.type}/${p.id}`;
                return (
                  <tr key={`${p.type}:${p.id}`} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <Link href={href} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      {kind ? null : <span className="block text-xs text-muted-foreground">{kindLabel(p.type)}</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.active > 0 ? p.active : <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.total > 0 ? p.total : <span className="text-muted-foreground">None yet</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={href} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            )
          );
        })}
      </AdminTable>

      {complete ? null : (
        <p className="mt-3 text-sm text-warning">
          There are more entitlements than this page reads at once, so the oldest are not counted here.
        </p>
      )}
    </>
  );
}
