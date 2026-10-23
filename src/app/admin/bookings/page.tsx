import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminGroupSection } from "@/components/admin/AdminGroupSection";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch } from "@/components/admin/AdminUI";
import { ButtonLink } from "@/components/ui/Button";
import { PRODUCT_KIND_LABEL, PRODUCT_KINDS, adminBookingDirectory } from "@/lib/admin/booking-products";
import { applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Bookings · Admin", robots: { index: false } };

/**
 * Bookings, by what was booked — note 10 §33.2.
 *
 * THE PRODUCTS FIRST (owner, 2026-10-13). Bookings come from several kinds of
 * product, and one list of every booking mixed a festival's tickets with a
 * series' sessions and a cohort's workshops. Staff arrive with a product in
 * mind, so this page lists the things that can be booked, each with how many
 * bookings it has, and opening one shows that product's bookings alone, where
 * a run, an intake or a single session can be picked.
 *
 * Every bookable product is listed, booked or not: an event nobody has booked
 * yet is something staff want to see. There is no "All bookings" button
 * (owner, 2026-10-14: the sections are the best display); the flat list still
 * exists at /admin/bookings/all, with nothing linking to it.
 */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("bookings.read", "/admin/bookings");
  const params = await searchParams;
  const query = readQuery(params);

  const { products, bookings, complete } = await adminBookingDirectory();

  const searched = searchRows(products, query, (p) => [p.name, PRODUCT_KIND_LABEL[p.kind]]);
  const f = applyFilters(searched, params, [
    { key: "kind", name: "Kind", read: (p) => p.kind, label: (v) => PRODUCT_KIND_LABEL[v as keyof typeof PRODUCT_KIND_LABEL] ?? v },
    { key: "booked", name: "Bookings", read: (p) => (p.total > 0 ? "some" : "none"), label: (v) => (v === "some" ? "Has bookings" : "None yet") },
  ]);
  const sort = readSort(params, ["name", "upcoming", "total"]);
  const sorted = sortRows(f.rows, sort, { name: (p) => p.name, upcoming: (p) => p.upcoming, total: (p) => p.total });
  const carry = { q: query, sort: sort?.key, dir: sort?.dir, ...f.active };

  const live = bookings.filter((b) => b.status !== "cancelled").length;

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        meta={`${live} in total`}
        description="Events and one-to-one coaching. Pick one to see who has booked it. Event tickets are checked in from Event check-in."
        actions={
          <>
            <ButtonLink href="/admin/check-in" variant="outline" size="sm">
              Event check-in
            </ButtonLink>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/bookings"
          query={query}
          label="Find an event or one-to-one service"
          placeholder="Event or one-to-one service"
          keep={{ ...carry, q: undefined }}
        />
        <AdminSort
          path="/admin/bookings"
          state={sort}
          params={{ q: query, ...f.active }}
          unsorted={{ label: query ? "Best match" : "By kind" }}
          options={[
            { label: "Most upcoming", key: "upcoming", dir: "desc" },
            { label: "Most bookings", key: "total", dir: "desc" },
            { label: "Name A to Z", key: "name", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path="/admin/bookings" {...c} params={carry} />
        ))}
      </div>

      <AdminTable
        headers={[
          { label: "What was booked", key: "name" },
          { label: "Upcoming", key: "upcoming", first: "desc" },
          { label: "Total bookings", key: "total", first: "desc" },
          "",
        ]}
        sort={{ path: "/admin/bookings", state: sort, params: { q: query, ...f.active } }}
        empty={sorted.length === 0 ? (query ? `Nothing matches “${query}”.` : "Nothing can be booked yet.") : undefined}
        sectioned
      >
        {/* Under a heading per kind, unless a sort or a search has put the
            products in an order of its own. */}
        {(sort || query ? [null] : PRODUCT_KINDS).map((kind) => {
          const rows = kind ? sorted.filter((p) => p.kind === kind) : sorted;
          if (rows.length === 0) return null;
          return (
            kind ? (
              <AdminGroupSection key={kind} label={PRODUCT_KIND_LABEL[kind]} count={rows.length} colSpan={4}>
              {rows.map((p) => {
                const href = `/admin/bookings/${p.kind}/${p.id}`;
                return (
                  <tr key={`${p.kind}:${p.id}`} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <Link href={href} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      {kind ? null : (
                        <span className="block text-xs text-muted-foreground">{PRODUCT_KIND_LABEL[p.kind]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.upcoming > 0 ? p.upcoming : <span className="text-muted-foreground">None</span>}
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
                const href = `/admin/bookings/${p.kind}/${p.id}`;
                return (
                  <tr key={`${p.kind}:${p.id}`} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <Link href={href} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      {kind ? null : (
                        <span className="block text-xs text-muted-foreground">{PRODUCT_KIND_LABEL[p.kind]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {p.upcoming > 0 ? p.upcoming : <span className="text-muted-foreground">None</span>}
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
          There are more bookings than this page reads at once, so the oldest are not counted here.
        </p>
      )}
    </>
  );
}
