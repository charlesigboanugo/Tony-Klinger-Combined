import type { Metadata } from "next";
import Link from "next/link";

import { AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, FilterTabs, humanise, PersonCell, ukDateTime } from "@/components/admin/AdminUI";
import {
  BOOKABLE_LABEL,
  BOOKINGS_TYPES,
  BOOKING_STATUSES,
  adminBookingList,
  isOneOf,
  peopleByIds,
} from "@/lib/admin/operations";
import { SEARCH_DEPTH, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { BackLink } from "@/components/ui/BackLink";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "All bookings · Admin", robots: { index: false } };

/**
 * Every booking across every bookable type — note 09 §29–§35.
 *
 * THE FLAT LIST, one step in from Bookings since 2026-10-13: `/admin/bookings`
 * now opens on the products that are booked (note 10 §33.2), and this is its
 * "All bookings" view, for finding one customer's bookings across everything.
 * It was `/admin/bookings` itself; to put it back see REVERSE.md.
 *
 * Filtered by type and status through the URL. An unpaid private-coaching
 * HOLD is shown as such rather than as a booking: it becomes one only when
 * payment confirms it (migration 0020).
 */
export default async function AdminAllBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("bookings.read", "/admin/bookings/all");
  const params = await searchParams;
  const type = isOneOf(BOOKINGS_TYPES, params.type) ? params.type : undefined;
  const status = isOneOf(BOOKING_STATUSES, params.status) ? params.status : undefined;

  const query = readQuery(params);
  const { bookings: loaded, counts } = await adminBookingList({ type, status }, query ? SEARCH_DEPTH : undefined);
  const people = await peopleByIds(loaded.map((b) => b.user_id));
  // By who booked, what they booked, or the ticket reference.
  const bookings = searchRows(loaded, query, (b) => [
    people.get(b.user_id)?.name,
    people.get(b.user_id)?.email,
    b.title,
    b.reference,
    BOOKABLE_LABEL[b.bookable_type],
    humanise(b.status),
  ]);

  const sort = readSort(params, ["when", "what", "who", "status", "reference"]);
  const sortedBookings = sortRows(bookings, sort, {
    when: (b) => b.starts_at,
    what: (b) => b.title ?? BOOKABLE_LABEL[b.bookable_type],
    who: (b) => people.get(b.user_id)?.name ?? people.get(b.user_id)?.email,
    status: (b) => b.status,
    reference: (b) => b.reference,
  });
  const kept = { sort: sort?.key, dir: sort?.dir, q: query };

  return (
    <>
      <BackLink href="/admin/bookings">Bookings by product</BackLink>
      <AdminPageHeader
        title="All bookings"
        meta={`${counts.all} in total`}
        description="Event tickets and one-to-one coaching times. Event tickets are checked in from Event check-in."
        actions={
          <Link
            href="/admin/check-in"
            className="inline-flex h-9 items-center rounded-full border border-input-border px-4 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Event check-in
          </Link>
        }
      />

      <FilterTabs
        label="Filter bookings by type"
        path="/admin/bookings/all"
        param="type"
        current={type}
        keep={{ status, ...kept }}
        options={[
          { value: undefined, label: "All", count: counts.all },
          ...BOOKINGS_TYPES.filter((t) => counts[t] > 0 || t === type).map((t) => ({
            value: t,
            label: BOOKABLE_LABEL[t],
            count: counts[t],
          })),
        ]}
      />

      <FilterTabs
        label="Filter bookings by status"
        path="/admin/bookings/all"
        param="status"
        current={status}
        keep={{ type, ...kept }}
        options={[
          { value: undefined, label: "Any status" },
          ...BOOKING_STATUSES.map((s) => ({ value: s, label: humanise(s) })),
        ]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/bookings/all"
          query={query}
          label="Name, email, session or reference"
          placeholder="Name, email, session or reference"
          keep={{ type, status, sort: sort?.key, dir: sort?.dir }}
        />
        <AdminSort
          path="/admin/bookings/all"
          state={sort}
          params={{ type, status, q: query }}
          unsorted={{ label: query ? "Best match" : "Default order" }}
          options={[
            { label: "Latest date first", key: "when", dir: "desc" },
            { label: "Earliest date first", key: "when", dir: "asc" },
            { label: "Person A to Z", key: "who", dir: "asc" },
            { label: "What A to Z", key: "what", dir: "asc" },
            { label: "Status", key: "status", dir: "asc" },
          ]}
        />
      </div>

      <AdminTable
        headers={[
          { label: "When", key: "when", first: "desc" },
          { label: "What", key: "what" },
          { label: "Who", key: "who" },
          { label: "Status", key: "status" },
          { label: "Reference", key: "reference" },
        ]}
        sort={{ path: "/admin/bookings/all", state: sort, params: { type, status, q: query } }}
        empty={bookings.length === 0 ? "No bookings match." : undefined}
      >
        {sortedBookings.map((b) => {
          const person = people.get(b.user_id);
          const hold = b.bookable_type === "private_coaching" && !b.entitlement_id && b.status === "pending";
          return (
            <tr key={b.id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-3 whitespace-nowrap">{ukDateTime(b.starts_at)}</td>
              <td className="px-4 py-3">
                <span className="block font-medium">{b.title ?? BOOKABLE_LABEL[b.bookable_type]}</span>
                <span className="block text-xs text-muted-foreground">{BOOKABLE_LABEL[b.bookable_type]}</span>
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
