import type { Metadata } from "next";
import Link from "next/link";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, FilterTabs, PersonCell, humanise, ukDateTime } from "@/components/admin/AdminUI";
import {
  BOOKABLE_LABEL,
  BOOKABLE_TYPES,
  BOOKING_STATUSES,
  adminBookingList,
  isOneOf,
  peopleByIds,
} from "@/lib/admin/operations";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Bookings · Admin", robots: { index: false } };

/**
 * Every booking across every bookable type — note 09 §29–§35.
 *
 * Filtered by type and status through the URL. An unpaid private-coaching
 * HOLD is shown as such rather than as a booking: it becomes one only when
 * payment confirms it (migration 0020).
 */
export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requirePermission("bookings.read", "/admin/bookings");
  const params = await searchParams;
  const type = isOneOf(BOOKABLE_TYPES, params.type) ? params.type : undefined;
  const status = isOneOf(BOOKING_STATUSES, params.status) ? params.status : undefined;

  const { bookings, counts } = await adminBookingList({ type, status });
  const people = await peopleByIds(bookings.map((b) => b.user_id));

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        meta={`${counts.all} in total`}
        description="Places on events, coaching sessions, workshops and retreats. Event tickets are checked in from Check-in."
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
        path="/admin/bookings"
        param="type"
        current={type}
        keep={{ status }}
        options={[
          { value: undefined, label: "All", count: counts.all },
          ...BOOKABLE_TYPES.filter((t) => counts[t] > 0 || t === type).map((t) => ({
            value: t,
            label: BOOKABLE_LABEL[t],
            count: counts[t],
          })),
        ]}
      />

      <FilterTabs
        label="Filter bookings by status"
        path="/admin/bookings"
        param="status"
        current={status}
        keep={{ type }}
        options={[
          { value: undefined, label: "Any status" },
          ...BOOKING_STATUSES.map((s) => ({ value: s, label: humanise(s) })),
        ]}
      />

      <AdminTable
        headers={["When", "What", "Who", "Status", "Reference"]}
        empty={bookings.length === 0 ? "No bookings match." : undefined}
      >
        {bookings.map((b) => {
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
