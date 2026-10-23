import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, humanise, PersonCell, ukDateTime } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import {
  BATCH_NAME,
  ITEM_NAME,
  PRODUCT_KIND_LABEL,
  PRODUCT_KINDS,
  adminBookingDirectory,
  type ProductKind,
} from "@/lib/admin/booking-products";
import { isOneOf, peopleByIds } from "@/lib/admin/operations";
import { applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Bookings · Admin", robots: { index: false } };

/**
 * One product's bookings — note 10 §33.2.
 *
 * Everybody booked on one event, series, one-to-one service, cohort or
 * retreat. Where the product runs more than once, the buttons beside search
 * narrow it to one batch (a run, an intake, a month) and then to one session
 * or workshop; each lists only what this product actually has, with counts.
 *
 * An unpaid one-to-one HOLD is shown as such rather than as a booking: it
 * becomes one only when the payment arrives.
 */
export default async function AdminProductBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind: rawKind, id } = await params;
  // The kind comes from the URL, so it is checked against the fixed set.
  if (!isOneOf(PRODUCT_KINDS, rawKind)) notFound();
  const kind: ProductKind = rawKind;
  const path = `/admin/bookings/${kind}/${id}`;

  await requirePermission("bookings.read", path);
  const search = await searchParams;
  const query = readQuery(search);

  const directory = await adminBookingDirectory();
  const product = directory.products.find((p) => p.kind === kind && p.id === id);
  if (!product) notFound();

  const mine = directory.bookings.filter((b) => b.kind === kind && b.productId === id);
  const people = await peopleByIds(mine.map((b) => b.user_id));

  const searched = searchRows(mine, query, (b) => [
    people.get(b.user_id)?.name,
    people.get(b.user_id)?.email,
    b.title,
    b.reference,
    b.batchLabel,
    humanise(b.status),
  ]);

  // The batch and the item, then the status. Each is offered only where this
  // kind of product has one.
  const labelOf = (pick: (b: (typeof mine)[number]) => [string | null, string | null]) => {
    const labels = new Map(mine.map((b) => pick(b)).filter(([key]) => key) as Array<[string, string | null]>);
    return (value: string) => labels.get(value) ?? value;
  };
  const f = applyFilters(searched, search, [
    ...(BATCH_NAME[kind]
      ? [{ key: "batch", name: BATCH_NAME[kind] as string, read: (b: (typeof mine)[number]) => b.batchId, label: labelOf((b) => [b.batchId, b.batchLabel]) }]
      : []),
    ...(ITEM_NAME[kind]
      ? [{ key: "item", name: ITEM_NAME[kind] as string, read: (b: (typeof mine)[number]) => b.itemId, label: labelOf((b) => [b.itemId, b.itemLabel]) }]
      : []),
    { key: "status", name: "Status", read: (b: (typeof mine)[number]) => b.status, label: humanise },
  ]);

  const sort = readSort(search, ["when", "what", "who", "status", "reference"], query ? undefined : { key: "when", dir: "desc" });
  const sorted = sortRows(f.rows, sort, {
    when: (b) => b.starts_at,
    what: (b) => b.title,
    who: (b) => people.get(b.user_id)?.name ?? people.get(b.user_id)?.email,
    status: (b) => b.status,
    reference: (b) => b.reference,
  });
  const sortParams = search.sort ? { sort: sort?.key, dir: sort?.dir } : {};
  const carry = { q: query, ...sortParams, ...f.active };
  const narrowed = sorted.length < mine.length;

  return (
    <>
      <BackLink href="/admin/bookings">All products</BackLink>
      <AdminPageHeader
        title={product.name}
        meta={narrowed ? `${sorted.length} of ${mine.length} bookings` : `${mine.length} booking${mine.length === 1 ? "" : "s"}`}
        description={`${PRODUCT_KIND_LABEL[kind]}. ${product.upcoming} still to happen.`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path={path}
          query={query}
          label="Name, email or reference"
          placeholder="Name, email or reference"
          keep={{ ...carry, q: undefined }}
        />
        <AdminSort
          path={path}
          state={sort}
          params={{ q: query, ...f.active }}
          unsorted={query ? { label: "Best match" } : undefined}
          options={[
            { label: "Latest date first", key: "when", dir: "desc" },
            { label: "Earliest date first", key: "when", dir: "asc" },
            { label: "Person A to Z", key: "who", dir: "asc" },
            { label: "Status", key: "status", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path={path} {...c} params={carry} />
        ))}
      </div>

      <AdminTable
        headers={[
          { label: "When", key: "when", first: "desc" },
          { label: "What", key: "what" },
          { label: "Who", key: "who" },
          { label: "Status", key: "status" },
          { label: "Reference", key: "reference" },
        ]}
        sort={{ path, state: sort, params: { q: query, ...f.active } }}
        empty={
          sorted.length === 0
            ? mine.length === 0
              ? "Nobody has booked this yet."
              : "No bookings match. Set a filter back to Any to see more."
            : undefined
        }
      >
        {sorted.map((b) => {
          const person = people.get(b.user_id);
          const hold = b.bookable_type === "private_coaching" && !b.entitlement_id && b.status === "pending";
          return (
            <tr key={b.id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-3 whitespace-nowrap">{ukDateTime(b.starts_at)}</td>
              <td className="px-4 py-3">
                <span className="block font-medium">{b.title}</span>
                {b.batchLabel ? <span className="block text-xs text-muted-foreground">{b.batchLabel}</span> : null}
              </td>
              <td className="px-4 py-3">
                <PersonCell id={b.user_id} name={person?.name} email={person?.email} />
              </td>
              <td className="px-4 py-3">
                {hold ? <StatusPill value="held — awaiting payment" /> : <StatusPill value={b.status} />}
                {b.checked_in_at ? (
                  <span className="mt-1 block text-xs text-success">Checked in {ukDateTime(b.checked_in_at)}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {b.reference ? (
                  b.bookable_type === "event" ? (
                    <Link href={`/admin/check-in/${b.reference}`} className="font-mono text-xs whitespace-nowrap hover:text-accent">
                      {b.reference}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs whitespace-nowrap">{b.reference}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </>
  );
}
