import type { Metadata } from "next";
import Link from "next/link";

import { AccountGroup, AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { StatusPill } from "@/components/account/StatusPill";
import { CancelButton } from "@/app/account/bookings/CancelButton";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { dateBadge, formatDateTime } from "@/lib/account/format";
import { sessionCredits } from "@/lib/academy";
import { myBookingsByTime, type MyBooking } from "@/lib/bookings";
import { myPrivateCredits } from "@/lib/bookings/private";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";
import { groupBy } from "@/lib/utils/group";

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

/**
 * Which group a booking is listed under (owner, 2026-10-09: by kind, and
 * Group Coaching by series, not one run of dates with everything in it).
 */
function kind(b: MyBooking): string {
  switch (b.bookable_type) {
    case "private_coaching":
      return "One-to-one coaching";
    case "event":
      return "Events";
    case "cohort_workshop":
      return b.seriesName ? `Cohort workshops · ${b.seriesName}` : "Cohort workshops";
    case "retreat":
      return "Retreats";
    default:
      return "Other";
  }
}

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
  const [all, privateCredits, groupCredits] = await Promise.all([
    myBookingsByTime(),
    myPrivateCredits(),
    sessionCredits(),
  ]);
  // NOT A BOOKING (owner, 2026-10-09): a single Group Coaching session is paid
  // for with its date chosen as it is bought, like a place on a series. It is
  // held as a booking row underneath, but nobody booked it, so it is not
  // listed here; it is in the Academy with the rest of that series.
  const booked = (b: MyBooking) => b.bookable_type !== "group_coaching_session";
  const upcoming = all.upcoming.filter(booked);
  const rest = all.rest.filter(booked);
  const total = upcoming.length + rest.length;
  // Sessions paid for and still waiting for a time: the only reason to send
  // somebody to /book (owner, 2026-10-09: booking is for one-to-one coaching,
  // events and single sessions; a series, cohort or retreat is not booked).
  const toBook = privateCredits.reduce((n, c) => n + c.remaining, 0) + (groupCredits?.remaining ?? 0);
  const bookAction =
    toBook > 0 ? (
      <ButtonLink href="/book" size="sm">
        Choose a time ({toBook} to schedule)
      </ButtonLink>
    ) : null;

  return (
    <>
      <AccountHeader
        title="Bookings"
        description="The one-to-one sessions you have booked, and your event tickets."
        actions={bookAction ?? undefined}
      />

      {/* What is NOT here, and where it is: the question this page raised
          when it said "Nothing coming up" to somebody on two series. */}
      <p className="mb-10 flex flex-col gap-3 rounded-(--radius-lg) border border-border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <span className="text-muted-foreground">
          A Group Coaching series or single session, a cohort and a retreat are not booked: your place is kept when
          you pay. Those are in your Academy, with their dates and joining links.
        </span>
        <Link href="/academy" className="shrink-0 font-medium text-primary underline-offset-4 hover:underline">
          Go to your Academy
        </Link>
      </p>

      {total === 0 ? (
        <EmptyState icon="calendar"
          title="No bookings yet"
          description="One-to-one sessions you book and your event tickets appear here."
          action={
            bookAction ?? (
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink href="/coaching/private-coaching">One-to-one coaching</ButtonLink>
                <ButtonLink href="/events" variant="outline">
                  Events
                </ButtonLink>
              </div>
            )
          }
        />
      ) : (
        <div className="space-y-14 sm:space-y-16">
          {upcoming.length > 0 ? (
            <AccountSection title="Coming up">
              <div className="space-y-8">
                {groupBy(upcoming, kind).map((g) => (
                  <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                    <ul className="space-y-3">
                      {g.items.map((b) => (
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
                          <CancelButton
                            bookingId={b.id}
                            what={title(b)}
                            when={b.starts_at ? formatDateTime(b.starts_at) : null}
                            kind={b.bookable_type === "private_coaching" ? "private_coaching" : b.bookable_type === "event" ? "event" : "other"}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                      ))}
                    </ul>
                  </AccountGroup>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Cancel a one-to-one session at least 48 hours ahead and it is returned to your
                account to book again. Cancelling a free event place offers it to the next person
                on the waiting list.
              </p>
            </AccountSection>
          ) : (
            <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {toBook > 0
                  ? "Nothing booked yet. You have sessions paid for and waiting for a time."
                  : "Nothing booked at the moment."}
              </p>
              {bookAction}
            </div>
          )}

          {rest.length > 0 ? (
            <AccountSection title="Past and cancelled">
              <div className="space-y-8">
                {groupBy(rest, kind).map((g) => (
                  <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                    <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border">
                      {g.items.map((b) => (
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
                  </AccountGroup>
                ))}
              </div>
            </AccountSection>
          ) : null}
        </div>
      )}
    </>
  );
}
