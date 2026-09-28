import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { DateBadge, JoinAction, RecordingAction } from "@/components/academy/SessionParts";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionCredits } from "@/lib/academy";
import { myCoaching, myPrivateCoaching } from "@/lib/academy/delivery";
import { formatSlot } from "@/lib/academy/format";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Coaching", robots: { index: false } };

/**
 * Note 03 §21, note 07 §36 — the customer's entitled coaching, not the public
 * offer, in the order someone opens it:
 *
 *   Booked       sessions they hold a seat in, with the joining link in the
 *                window around the start (lib/academy/delivery `joinState`)
 *   Available    sessions their access makes bookable, not yet booked
 *   Replays      sessions they attended, with the recording where there is one
 *
 * A booking and an entitlement are different things (note 09 §29): credits
 * make a session visible and bookable, only a booking makes it joinable.
 *
 * Private coaching (migration 0020) sits in the same Booked list — one place
 * for everything coming up with Tony — and a paid session not yet given a
 * time shows as a prompt to choose one. It has no replays.
 */
export default async function AcademyCoachingPage({ searchParams }: PageProps<"/academy/coaching">) {
  await requireUser("/academy/coaching");
  const [credits, coaching, privately, params] = await Promise.all([
    sessionCredits(),
    myCoaching(),
    myPrivateCoaching(),
    searchParams,
  ]);
  const { available, past } = coaching;

  // Group seats and private sessions, one timeline.
  const booked = [
    ...coaching.booked.map((s) => ({ ...s, detail: s.seriesName })),
    ...privately.booked.map((s) => ({ ...s, title: s.serviceName, detail: "Private, with Tony" })),
  ].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const nothing = booked.length + available.length + past.length + privately.credits.length === 0;
  const justBooked = params.booked === "private";

  return (
    <>
      <AccountHeader
        title="Coaching"
        description="Your booked sessions, what you can book next, and replays of sessions you've attended."
      />

      {justBooked ? (
        <p role="status" className="mb-8 rounded-(--radius) border border-success/40 bg-success/10 px-4 py-3 text-sm">
          Your private session is booked. It&apos;s below, and a confirmation is on its way by email.
        </p>
      ) : null}

      {privately.credits.map((c) => (
        <div
          key={c.serviceSlug}
          className="mb-6 flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <p className="text-lg font-semibold">
              {c.remaining} private session{c.remaining === 1 ? "" : "s"} to book
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{c.serviceName} · paid for, waiting for a time.</p>
          </div>
          <ButtonLink href={`/bookings/private/${c.serviceSlug}`} size="sm">
            Choose a time
          </ButtonLink>
        </div>
      ))}

      {credits ? (
        <div className="mb-10 flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-display text-2xl font-semibold">
              {credits.remaining} session credit{credits.remaining === 1 ? "" : "s"} left
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A credit is used when you book, and returned if you cancel in good time.
            </p>
          </div>
          {credits.remaining > 0 && available.length > 0 ? (
            <ButtonLink href="#available" size="sm">
              Book a session
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {nothing ? (
        <EmptyState icon="chat"
          title="No sessions yet"
          description="Sessions you can book appear here once they're on the calendar and your access covers them."
          action={<ButtonLink href="/coaching/group-coaching">See Group Coaching</ButtonLink>}
        />
      ) : (
        <div className="space-y-12">
          <AccountSection title="Booked">
            {booked.length ? (
              <ul className="space-y-3">
                {booked.map((s, i) => (
                  <li
                    key={s.id}
                    className={
                      i === 0
                        ? "flex flex-col gap-4 rounded-(--radius-lg) bg-block-noir p-5 text-block-foreground shadow-lift sm:flex-row sm:items-center sm:p-6"
                        : "flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-4 sm:flex-row sm:items-center"
                    }
                  >
                    <DateBadge value={s.startsAt} large={i === 0} filled={i === 0} />
                    <div className="min-w-0 flex-1">
                      <p className={i === 0 ? "font-display text-xl font-semibold" : "font-medium"}>{s.title}</p>
                      <p className={i === 0 ? "mt-1 text-sm text-block-foreground/75" : "text-sm text-muted-foreground"}>
                        {formatSlot(s.startsAt, s.endsAt)}
                        {s.detail ? ` · ${s.detail}` : ""}
                      </p>
                    </div>
                    {s.join ? <JoinAction join={s.join} onBlock={i === 0} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                Nothing booked right now.
                {available.length ? " Choose a session below to reserve your seat." : ""}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Need to cancel or move a session?{" "}
              <Link href="/account/bookings" className="font-medium text-primary underline-offset-4 hover:underline">
                Manage bookings
              </Link>
            </p>
          </AccountSection>

          {available.length ? (
            <AccountSection title="Available to book">
              <ul id="available" className="scroll-mt-24 divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                {available.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                    <DateBadge value={s.startsAt} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSlot(s.startsAt, s.endsAt)}
                        {s.seriesName ? ` · ${s.seriesName}` : ""}
                      </p>
                    </div>
                    <ButtonLink href={`/bookings/${s.id}`} size="sm" variant="outline">
                      Book
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </AccountSection>
          ) : null}

          {past.length ? (
            <AccountSection title="Replays">
              <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                {past.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSlot(s.startsAt)}
                        {s.seriesName ? ` · ${s.seriesName}` : ""}
                      </p>
                    </div>
                    <RecordingAction recording={s.recording} />
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
