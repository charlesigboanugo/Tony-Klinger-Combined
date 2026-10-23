import type { Metadata } from "next";
import Link from "next/link";

import { AccountGroup, AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionCredits } from "@/lib/academy";
import { bookableSessions } from "@/lib/bookings";
import { myPrivateCredits } from "@/lib/bookings/private";
import { requireUser } from "@/lib/permissions";
import { groupBy } from "@/lib/utils/group";

export const metadata: Metadata = { title: "Book a session", robots: { index: false } };

const UK = "Europe/London";

/**
 * What this customer has to book — note 03 §11, note 04 §20.
 *
 * Distinct from /account/bookings, which shows and manages bookings already
 * made. This is where one is MADE.
 *
 * BOOKING BELONGS TO ONE-TO-ONE COACHING (owner, 2026-10-09). A series, a
 * cohort, an event and a retreat put the buyer where they paid to be, and a
 * single Group Coaching session is bought for a date. So what is listed here
 * is one-to-one sessions paid for and still to schedule — and, rarely, a Group
 * Coaching session left on the account because the date paid for filled as
 * the payment went through (migration 0022), with the dates of its series.
 *
 * Until then this page listed every scheduled group session the visitor could
 * read, with a "Choose" that led to "your access does not cover this".
 */
export default async function BookingsPage() {
  await requireUser("/book");
  const [sessions, credits, privateCredits] = await Promise.all([
    bookableSessions(),
    sessionCredits(),
    myPrivateCredits(),
  ]);

  // Group sessions are offered only against a session left to place, and only
  // those of the series it was bought for (or any, where it is for any).
  const forSeries = new Set((credits?.bySeries ?? []).filter((c) => c.remaining > 0).map((c) => c.series));
  const placeable =
    credits && credits.remaining > 0
      ? sessions.filter((s) => forSeries.has(null) || forSeries.has(s.seriesName))
      : [];

  const nothing = placeable.length === 0 && privateCredits.length === 0 && !(credits && credits.remaining > 0);

  return (
    <>
      <AccountHeader
        title="Book a session"
        description="Sessions you have paid for and still need a time for. Choose one to pick it."
      />

      {nothing ? (
        <EmptyState icon="calendar"
          title="Nothing to book just now"
          description="One-to-one sessions you have paid for appear here, to choose a time for. A series, a cohort, an event or a retreat needs no booking: your place is kept when you pay."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/coaching/private-coaching">One-to-one coaching</ButtonLink>
              <ButtonLink href="/account/bookings" variant="outline">
                Your bookings
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="space-y-12">
          {privateCredits.length > 0 ? (
            <AccountSection title="Private coaching">
              <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-surface shadow-card">
                {privateCredits.map((c) => (
                  <li key={c.slug} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.durationMinutes} minutes, one to one · {c.remaining} session
                        {c.remaining === 1 ? "" : "s"} to book
                      </p>
                    </div>
                    <ButtonLink href={`/book/private/${c.slug}`} size="sm">
                      Choose a time
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </AccountSection>
          ) : null}

          {credits && credits.remaining > 0 ? (
            <AccountSection title="Group Coaching">
              <p className="mb-4 rounded-(--radius) border border-border bg-surface px-4 py-3 text-sm">
                You have <span className="font-medium">{credits.remaining}</span> session
                {credits.remaining === 1 ? "" : "s"} paid for and not yet on a date. Choose one below.
              </p>

              {placeable.length === 0 ? (
                <p className="rounded-(--radius-lg) border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
                  No dates are open for it at the moment. They will appear here as soon as they are.{" "}
                  <Link href="/coaching/group-coaching" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                    See Group Coaching
                  </Link>
                </p>
              ) : (
                <div className="space-y-8">
                  {groupBy(placeable, (s) => s.seriesName ?? "Group Coaching").map((g) => (
                    <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                      <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-surface shadow-card">
                        {g.items.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                      <div className="min-w-0">
                        <p className="font-medium">{s.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(s.starts_at).toLocaleString("en-GB", {
                            weekday: "short", day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit", timeZone: UK,
                          })}
                        </p>
                      </div>
                      <ButtonLink href={`/book/${s.id}`} size="sm" variant="outline">
                        Choose
                      </ButtonLink>
                    </li>
                        ))}
                      </ul>
                    </AccountGroup>
                  ))}
                </div>
              )}
            </AccountSection>
          ) : null}
        </div>
      )}
    </>
  );
}
