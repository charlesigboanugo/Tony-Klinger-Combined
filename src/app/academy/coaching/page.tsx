import type { Metadata } from "next";
import Link from "next/link";

import { AccountGroup, AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { DateBadge, JoinAction, RecordingAction } from "@/components/academy/SessionParts";
import { StaffOnly } from "@/components/academy/StaffView";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { groupBy } from "@/lib/utils/group";
import { sessionCredits } from "@/lib/academy";
import { RunChooser } from "@/app/academy/coaching/RunChooser";
import { myCoaching, myPrivateCoaching, myRetreats, myRunChoices, sessionGroup } from "@/lib/academy/delivery";
import { formatDate } from "@/lib/account/format";
import { formatSlot } from "@/lib/academy/format";
import { academyStaffView, allRetreats } from "@/lib/academy/staff";
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
  const staffView = await academyStaffView();
  const [credits, coaching, privately, retreats, runChoices, params, everyRetreat] = await Promise.all([
    sessionCredits(),
    myCoaching(),
    myPrivateCoaching(),
    myRetreats(),
    myRunChoices(),
    searchParams,
    staffView ? allRetreats() : Promise.resolve([]),
  ]);
  const { past } = coaching;
  // Booking is for one-to-one (owner, 2026-10-09). Group sessions are offered
  // to book only against a session left on the account (migration 0022: the
  // date paid for filled as the payment went through), for its own series.
  const forSeries = new Set((credits?.bySeries ?? []).filter((c) => c.remaining > 0).map((c) => c.series));
  const available =
    credits && credits.remaining > 0
      ? coaching.available.filter((s) => forSeries.has(null) || forSeries.has(s.seriesName))
      : [];

  // THE STAFF VIEW (note 06 §23.2) also lists what the staff member holds no
  // place in: every scheduled session and retreat, without a book or join.
  const ownRetreats = new Set(retreats.map((r) => r.id));
  const staffRetreats = everyRetreat.filter((r) => !ownRetreats.has(r.id));
  const availableIds = new Set(available.map((s) => s.id));
  const scheduled = staffView ? coaching.available.filter((s) => !availableIds.has(s.id)) : [];

  // Group seats and private sessions, one timeline.
  const booked = [
    ...coaching.booked.map((s) => ({ ...s, detail: sessionGroup(s), group: sessionGroup(s) })),
    ...privately.booked.map((s) => ({ ...s, title: s.serviceName, detail: "Private, with Tony", group: "One-to-one with Tony" })),
  ].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const nothing =
    booked.length + available.length + past.length + privately.credits.length + retreats.length + runChoices.length +
      staffRetreats.length + scheduled.length ===
    0;
  const justBooked = params.booked === "private";

  return (
    <>
      <AccountHeader
        title="Coaching"
        description="Your sessions with their joining links, and the replays that are yours to watch."
      />

      {justBooked ? (
        <p role="status" className="mb-8 rounded-(--radius) border border-success/40 bg-success/10 px-4 py-3 text-sm">
          Your private session is booked. It&apos;s below, and a confirmation is on its way by email.
        </p>
      ) : null}

      {/* A retreat place (bought, or included in a membership). The date may
          not be set yet — said plainly, so the place is seen to be held. */}
      {retreats.map((r) => (
        <div
          key={r.id}
          className="mb-6 flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <p className="text-lg font-semibold">{r.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.startsAt
                ? formatSlot(r.startsAt, r.endsAt)
                : "Your place is held. The date is to be announced, and we will email you as soon as it is set."}
            </p>
            {r.notes ? <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p> : null}
          </div>
          {r.join ? <JoinAction join={r.join} /> : null}
        </div>
      ))}

      {staffRetreats.map((r) => (
        <div
          key={r.id}
          className="mb-6 flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <p className="text-lg font-semibold">{r.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatSlot(r.startsAt, r.endsAt)}</p>
            {r.notes ? <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p> : null}
          </div>
          <StaffOnly />
        </div>
      ))}

      {/* A series paid for and not yet on a run. Paying places the buyer
          automatically (migration 0021), so this shows only where no run had a
          place at that moment: take the place now there is one, or wait. */}
      {runChoices.map((choice) => (
        <div
          key={choice.seriesName}
          className="mb-6 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <p className="text-lg font-semibold">{choice.seriesName}: your place is waiting</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {choice.runs.length > 0
              ? "You have paid for this series, and its next dates are now open. Take your place and your seat is kept in every session."
              : "You have paid for this series. Its next dates are not open for registration yet; they will appear here as soon as they are."}
            {choice.expiresAt ? ` Use by ${formatDate(choice.expiresAt)}.` : ""}
          </p>
          {choice.runs.length > 0 ? (
            <RunChooser
              runs={choice.runs.map((r) => ({
                id: r.id,
                label: r.label,
                dates: `${formatDate(r.startsAt)} to ${formatDate(r.endsAt)}`,
                placesLeft: r.placesLeft,
              }))}
            />
          ) : null}
        </div>
      ))}

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
          <ButtonLink href={`/book/private/${c.serviceSlug}`} size="sm">
            Choose a time
          </ButtonLink>
        </div>
      ))}

      {credits ? (
        <div className="mb-10 flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-display text-2xl font-semibold">
              {credits.remaining} session{credits.remaining === 1 ? "" : "s"} to book
            </p>
            {/* Which series they are for, and by when (migration 0014). */}
            <ul className="mt-2 space-y-0.5 text-sm">
              {credits.bySeries.map((c) => (
                <li key={c.series ?? "any"}>
                  <span className="font-medium">
                    {c.remaining} {c.series ?? "any series"}
                  </span>
                  {c.series ? ` session${c.remaining === 1 ? "" : "s"}` : ""}
                  {c.expiresAt ? <span className="text-muted-foreground"> · use by {formatDate(c.expiresAt)}</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a date below, on the series it was bought for. It is returned if you cancel in good time.
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
          description="Your Group Coaching series and sessions, and your one-to-one sessions, appear here with their joining links."
          action={<ButtonLink href="/coaching/group-coaching">See Group Coaching</ButtonLink>}
        />
      ) : (
        <div className="space-y-12">
          {/* What is next, on its own: the one thing most people came for. */}
          {booked[0] ? (
            <AccountSection title="Next up">
              <div className="flex flex-col gap-4 rounded-(--radius-lg) bg-block-noir p-5 text-block-foreground shadow-lift sm:flex-row sm:items-center sm:p-6">
                <DateBadge value={booked[0].startsAt} large filled />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">{booked[0].title}</p>
                  <p className="mt-1 text-sm text-block-foreground/75">
                    {formatSlot(booked[0].startsAt, booked[0].endsAt)}
                    {booked[0].detail ? ` · ${booked[0].detail}` : ""}
                  </p>
                </div>
                {booked[0].join ? <JoinAction join={booked[0].join} onBlock /> : null}
              </div>
            </AccountSection>
          ) : null}

          {/* Everything held, BY SERIES (owner, 2026-10-09): two series and
              one-to-one sessions in one run of dates had to be sorted in the
              reader's head. One group each, in date order within it. */}
          <AccountSection title="Your sessions">
            {booked.length ? (
              <div className="space-y-8">
                {groupBy(booked, (s) => s.group).map((g) => (
                  <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                    <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                      {g.items.map((s) => (
                        <li key={s.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                          <DateBadge value={s.startsAt} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{s.title}</p>
                            <p className="text-sm text-muted-foreground">{formatSlot(s.startsAt, s.endsAt)}</p>
                          </div>
                          {s.join ? <JoinAction join={s.join} /> : null}
                        </li>
                      ))}
                    </ul>
                  </AccountGroup>
                ))}
              </div>
            ) : (
              <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                Nothing coming up right now.
                {available.length ? " Choose a date below for the session you have paid for." : ""}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Need to cancel or move a one-to-one session?{" "}
              <Link href="/account/bookings" className="font-medium text-primary underline-offset-4 hover:underline">
                Manage bookings
              </Link>
            </p>
          </AccountSection>

          {available.length ? (
            <AccountSection title="Choose a date for your session">
              <div id="available" className="scroll-mt-24 space-y-8">
                {groupBy(available, (s) => s.seriesName ?? "Group Coaching").map((g) => (
                  <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                    <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                      {g.items.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                          <DateBadge value={s.startsAt} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{s.title}</p>
                            <p className="text-sm text-muted-foreground">{formatSlot(s.startsAt, s.endsAt)}</p>
                          </div>
                          <ButtonLink href={`/book/${s.id}`} size="sm" variant="outline">
                            Book
                          </ButtonLink>
                        </li>
                      ))}
                    </ul>
                  </AccountGroup>
                ))}
              </div>
            </AccountSection>
          ) : null}

          {scheduled.length ? (
            <AccountSection title="Scheduled sessions">
              <div className="space-y-8">
                {groupBy(scheduled, (s) => s.seriesName ?? "Group Coaching").map((g) => (
                  <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                    <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                      {g.items.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                          <DateBadge value={s.startsAt} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{s.title}</p>
                            <p className="text-sm text-muted-foreground">{formatSlot(s.startsAt, s.endsAt)}</p>
                          </div>
                          <StaffOnly />
                        </li>
                      ))}
                    </ul>
                  </AccountGroup>
                ))}
              </div>
            </AccountSection>
          ) : null}

          {past.length ? (
            <AccountSection title="Replays">
              <div className="space-y-8">
                {groupBy(past, (s) => s.seriesName ?? "Group Coaching").map((g) => (
                  <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                    <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                      {g.items.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{s.title}</p>
                            <p className="text-sm text-muted-foreground">{formatSlot(s.startsAt)}</p>
                          </div>
                          <RecordingAction recording={s.recording} />
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
