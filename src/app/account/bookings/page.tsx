import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { StatusPill } from "@/components/account/StatusPill";
import { CancelButton } from "@/app/account/bookings/CancelButton";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { dateBadge, formatDateTime } from "@/lib/account/format";
import { myBookingsByTime, type MyBooking } from "@/lib/bookings";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Bookings", robots: { index: false } };

/**
 * Managing bookings — note 03 §24.
 *
 * Distinct from /bookings, which is where a booking is MADE. Merging them would
 * put availability-selection inside the account area (R5).
 *
 * Each booking leads with a date badge — the fact someone scans a list of
 * bookings for — in the site red, which is for static marks like this
 * (teal is reserved for action and state).
 */
const BOOKING_STATUS: Record<string, string> = {
  confirmed: "Booked",
  pending: "Pending",
  cancelled: "Cancelled",
  completed: "Attended",
  no_show: "Missed",
};

function title(b: MyBooking) {
  return b.title ?? b.bookable_type.replace(/_/g, " ");
}

function DateBadge({ value, muted }: { value: string | null; muted?: boolean }) {
  if (!value) return <div aria-hidden="true" className="h-14 w-14 shrink-0" />;
  const { day, month } = dateBadge(value);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid h-14 w-14 shrink-0 place-items-center rounded-(--radius) text-center leading-none",
        muted ? "bg-surface-muted text-muted-foreground" : "bg-button text-button-foreground",
      )}
    >
      <span>
        <span className="block font-display text-xl font-semibold">{day}</span>
        <span className="mt-0.5 block text-[0.625rem] font-semibold tracking-widest uppercase">
          {month}
        </span>
      </span>
    </div>
  );
}

export default async function AccountBookingsPage() {
  await requireUser("/account/bookings");
  const { upcoming, rest } = await myBookingsByTime();
  const total = upcoming.length + rest.length;

  return (
    <>
      <AccountHeader
        title="Bookings"
        description="Your places on sessions, private coaching, workshops and events."
        actions={
          total > 0 ? (
            <ButtonLink href="/bookings" size="sm" variant="outline">
              Book a session
            </ButtonLink>
          ) : null
        }
      />

      {total === 0 ? (
        <EmptyState icon="calendar"
          title="No bookings yet"
          description="Event tickets appear here as soon as you buy them. Group Coaching sessions appear once you book one."
          action={<ButtonLink href="/bookings">Book a session</ButtonLink>}
        />
      ) : (
        <div className="space-y-14 sm:space-y-16">
          {upcoming.length > 0 ? (
            <AccountSection title="Coming up">
              <ul className="space-y-3">
                {upcoming.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-(--radius-lg) border border-border bg-surface p-4 shadow-card sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <DateBadge value={b.starts_at} />
                        <div className="min-w-0">
                          <p className={cn("font-medium text-pretty", !b.title && "capitalize")}>{title(b)}</p>
                          <p className="text-sm text-muted-foreground">
                            {b.starts_at ? formatDateTime(b.starts_at) : null}
                            {b.seriesName && b.seriesName !== "Event" ? ` · ${b.seriesName}` : ""}
                          </p>
                          {b.reference ? (
                            <p className="mt-1 font-mono text-xs tracking-wider text-muted-foreground">
                              Ref {b.reference}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        {b.bookable_type === "event" ? (
                          <ButtonLink href={`/account/tickets/${b.id}`} size="sm">
                            View ticket
                          </ButtonLink>
                        ) : null}
                        {b.bookable_type === "event" && b.entitlement_id ? (
                          <Link
                            href="/contact"
                            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-accent"
                          >
                            Can&apos;t come?
                          </Link>
                        ) : (
                          <CancelButton bookingId={b.id} />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Cancel at least 24 hours before a group session, or 48 hours before a private
                one, and the session is returned to your account. Cancelling a free event place
                offers it to the next person on the waiting list.
              </p>
            </AccountSection>
          ) : (
            <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Nothing coming up.</p>
              <ButtonLink href="/bookings" size="sm">
                Book a session
              </ButtonLink>
            </div>
          )}

          {rest.length > 0 ? (
            <AccountSection title="Past and cancelled">
              <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border">
                {rest.map((b) => (
                  <li key={b.id} className="flex items-center gap-4 p-4">
                    <DateBadge value={b.starts_at} muted />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium text-muted-foreground", !b.title && "capitalize")}>
                        {title(b)}
                      </p>
                      {b.bookable_type === "event" && b.status !== "cancelled" ? (
                        <Link
                          href={`/account/tickets/${b.id}`}
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-accent"
                        >
                          Ticket
                        </Link>
                      ) : null}
                    </div>
                    <StatusPill>{BOOKING_STATUS[b.status] ?? b.status}</StatusPill>
                  </li>
                ))}
              </ul>
            </AccountSection>
          ) : null}
        </div>
      )}
    </>
  );
}
