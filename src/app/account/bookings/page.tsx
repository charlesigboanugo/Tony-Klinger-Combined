import type { Metadata } from "next";

import { CancelButton } from "@/app/account/bookings/CancelButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myBookingsByTime } from "@/lib/bookings";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Bookings", robots: { index: false } };

/**
 * Managing bookings — note 03 §24.
 *
 * Distinct from /bookings, which is where a booking is MADE. Merging them would
 * put availability-selection inside the account area (R5).
 */
export default async function AccountBookingsPage() {
  await requireUser("/account/bookings");
  const { upcoming, rest } = await myBookingsByTime();
  const total = upcoming.length + rest.length;

  return (
    <>
      <PageHeader title="Bookings"
        description="Your places on sessions, workshops and events."
      />

      {total === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Sessions your access covers can be booked from the booking area."
          action={<ButtonLink href="/bookings">Book a session</ButtonLink>}
        />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Upcoming
              </h2>
              <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium capitalize">
                        {b.title ?? b.bookable_type.replace(/_/g, " ")}
                      </p>
                      {b.seriesName ? (
                        <p className="text-sm text-muted-foreground">{b.seriesName}</p>
                      ) : null}
                      {b.starts_at ? (
                        <p className="text-sm text-muted-foreground">
                          {new Date(b.starts_at).toLocaleString("en-GB", {
                            weekday: "short", day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      ) : null}
                    </div>
                    <CancelButton bookingId={b.id} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Cancel at least 24 hours before a session and the credit is
                returned to your account.
              </p>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Past and cancelled
              </h2>
              <ul className="divide-y divide-border rounded-(--radius) border border-border">
                {rest.map((b) => (
                  <li key={b.id} className="flex items-baseline justify-between gap-4 p-4">
                    <p className="text-muted-foreground capitalize">
                      {b.title ?? b.bookable_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{b.status}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
