import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionCredits, upcomingSessions } from "@/lib/academy";
import { myBookings } from "@/lib/bookings";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Coaching", robots: { index: false } };

/**
 * Note 03 §21 — the customer's entitled coaching, not the public offer.
 *
 * `upcomingSessions()` is the SCHEDULE (every session your entitlement makes
 * visible), not what you have actually reserved — the same distinction that
 * made the dashboard's "Coming up" show entitled sessions as though they
 * were already booked (note 09 §29). Here that is correct: this page's job
 * is browsing what CAN be booked. But a session already reserved must not
 * still offer "Book" as though nothing had happened — cross-referenced
 * against `myBookings()` so an already-booked row reads as confirmed.
 */
export default async function AcademyCoachingPage() {
  await requireUser("/academy/coaching");
  const [credits, sessions, bookings] = await Promise.all([
    sessionCredits(),
    upcomingSessions(10),
    myBookings(),
  ]);

  const bookedSessionIds = new Set(
    bookings
      .filter((b) => b.bookable_type === "group_coaching_session" && b.status === "confirmed")
      .map((b) => b.bookable_id),
  );

  return (
    <>
      <PageHeader
        title="Coaching"
        description="Your series, sessions and remaining credits."
      />

      {credits ? (
        <div className="mb-6 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Session credits remaining</p>
          <p className="mt-1 font-display text-3xl font-semibold">{credits.remaining}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A credit is used when you book a session, and returned if you cancel
            in good time.
          </p>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions scheduled"
          description="Sessions you can book appear here once they're on the calendar."
          action={<ButtonLink href="/coaching/group-coaching">See group coaching</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
          {sessions.map((s) => {
            const booked = bookedSessionIds.has(s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.group_coaching_series?.name}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <time dateTime={s.starts_at} className="text-sm text-muted-foreground">
                    {new Date(s.starts_at).toLocaleString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </time>
                  {booked ? (
                    <span className="text-sm font-medium text-success">Booked &#10003;</span>
                  ) : (
                    <ButtonLink href={`/bookings/${s.id}`} size="sm" variant="outline">
                      Book
                    </ButtonLink>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
