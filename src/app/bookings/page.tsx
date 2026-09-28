import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionCredits } from "@/lib/academy";
import { bookableSessions } from "@/lib/bookings";
import { myPrivateCredits } from "@/lib/bookings/private";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Book a session", robots: { index: false } };

const UK = "Europe/London";

/**
 * What this customer can book — note 03 §11, note 04 §20.
 *
 * Distinct from /account/bookings, which manages bookings already made. The
 * start of the booking task: private coaching sessions still to schedule, then
 * the group sessions their access covers. Each row leads one step on — a time
 * picker, or a confirmation — and every step below has a way back here.
 */
export default async function BookingsPage() {
  await requireUser("/bookings");
  const [sessions, credits, privateCredits] = await Promise.all([
    bookableSessions(),
    sessionCredits(),
    myPrivateCredits(),
  ]);

  const nothing = sessions.length === 0 && privateCredits.length === 0;

  return (
    <>
      <BackLink href="/account/bookings">Your bookings</BackLink>

      <AccountHeader
        title="Book a session"
        description="Everything your access lets you book. Choose one to pick a time or confirm your place."
      />

      {nothing ? (
        <EmptyState icon="calendar"
          title="Nothing to book just now"
          description="Either no sessions are scheduled, or your current access doesn't cover any. Group coaching and private sessions can be booked once you have access."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/coaching/group-coaching">See group coaching</ButtonLink>
              <ButtonLink href="/coaching/private-coaching" variant="outline">
                Private coaching
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
                    <ButtonLink href={`/bookings/private/${c.slug}`} size="sm">
                      Choose a time
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </AccountSection>
          ) : null}

          <AccountSection title="Group coaching">
            {credits ? (
              <p className="mb-4 rounded-(--radius) border border-border bg-surface px-4 py-3 text-sm">
                <span className="font-medium">{credits.remaining}</span> session credit
                {credits.remaining === 1 ? "" : "s"} remaining.
              </p>
            ) : null}

            {sessions.length === 0 ? (
              <p className="rounded-(--radius-lg) border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
                No group sessions open to you right now.{" "}
                <Link href="/coaching/group-coaching" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  See group coaching
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-surface shadow-card">
                {sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.seriesName ? `${s.seriesName} · ` : ""}
                        {new Date(s.starts_at).toLocaleString("en-GB", {
                          weekday: "short", day: "numeric", month: "short",
                          hour: "2-digit", minute: "2-digit", timeZone: UK,
                        })}
                      </p>
                    </div>
                    <ButtonLink href={`/bookings/${s.id}`} size="sm" variant="outline">
                      Choose
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </AccountSection>
        </div>
      )}
    </>
  );
}
