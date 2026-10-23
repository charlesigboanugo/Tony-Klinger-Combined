import type { Metadata } from "next";
import Link from "next/link";

import { RunChooser } from "@/app/academy/coaching/RunChooser";
import { AccountGroup, AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { DateBadge, JoinAction, RecordingAction } from "@/components/academy/SessionParts";
import { StaffOnly } from "@/components/academy/StaffView";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myQaSessions } from "@/lib/academy/delivery";
import { formatSlot } from "@/lib/academy/format";
import { membershipChoices, myMembership } from "@/lib/academy/membership";
import { academyStaffView, STAFF_MEMBERSHIP } from "@/lib/academy/staff";
import { formatDate } from "@/lib/account/format";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Your pass", robots: { index: false } };

/**
 * A member's membership, delivered — note 07 §5–§12, §31; note 03 §17.
 *
 * `/coaching/passes` sells the tiers; this page is what one of them gives
 * the person who holds it, in the order they come for it:
 *
 *   Group Coaching   the series runs they are on, and the ones open to register for
 *   Playlists        the library they may watch, or the choice still to make
 *   Live Q&A         the next one and its joining link, then the recordings
 *
 * Every section is driven by the tier's own settings (how many series, how
 * many playlists, whether the Q&A is included), so nothing here names Silver,
 * Gold or Platinum and a change made in admin needs no change here.
 *
 * Payment, renewal and cancelling are not here: they are Account → Billing,
 * and this page links to it.
 */
export default async function AcademyMembershipPage() {
  await requireUser("/academy/pass");

  const [held, staffView] = await Promise.all([myMembership(), academyStaffView()]);
  // The staff view (note 06 §23.2) shows the pass as the top tier gives it,
  // with nothing to register for, choose, join or pay.
  const staffOnly = !held && staffView;
  const membership = held ?? (staffOnly ? STAFF_MEMBERSHIP : null);
  if (!membership) {
    return (
      <>
        <AccountHeader title="Your pass" description="A year of live Group Coaching, a growing video library and a monthly Q&A with Tony." />
        <EmptyState
          icon="star"
          title="You do not have a Coaching Pass yet"
          description="A Coaching Pass brings Group Coaching, the video playlists and, from Gold, the monthly Q&A into your Academy."
          action={<ButtonLink href="/coaching/passes">Compare the tiers</ButtonLink>}
        />
      </>
    );
  }

  const [{ series, playlists }, qa] = await Promise.all([
    membershipChoices(membership),
    membership.includesQa ? myQaSessions() : Promise.resolve({ upcoming: [], past: [] }),
  ]);

  if (staffOnly) {
    series.allowance = null;
    series.used = 0;
  }
  const seriesLeft = series.allowance == null ? null : Math.max(series.allowance - series.used, 0);
  const heldPlaylists = playlists.items.filter((p) => p.chosen);

  return (
    <>
      <AccountHeader
        title={membership.tierName}
        description={
          staffOnly
            ? "What a Coaching Pass gives, at the top tier."
            : membership.date
            ? membership.renews
              ? `Renews on ${formatDate(membership.date)}.`
              : `Runs until ${formatDate(membership.date)}.`
            : undefined
        }
        actions={
          staffOnly ? undefined : (
            <ButtonLink href="/account/billing" variant="outline" size="sm">
              Billing
            </ButtonLink>
          )
        }
      />

      {membership.pastDue ? (
        <p role="status" className="mb-8 rounded-(--radius) border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Your last payment did not go through. Your pass carries on for now;{" "}
          <Link href="/account/billing" className="font-medium underline underline-offset-4">
            update your card
          </Link>{" "}
          to keep it.
        </p>
      ) : null}

      {/*
        THE PASS AT A GLANCE (owner, 2026-10-09: "make sure this page is clear
        to read"). The page opened straight into a paragraph about series. It
        now starts with what the pass holds, one tile each, in the order of
        the sections below; each tile jumps to its section.
      */}
      <ul className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: "#group-coaching",
            label: "Group Coaching",
            value: series.allowance == null ? "Every series" : `${series.used} of ${series.allowance} series`,
            note: series.allowance == null ? "Register as each opens" : seriesLeft === 0 ? "All taken this year" : `${seriesLeft} left to take`,
          },
          {
            href: "/academy/playlists",
            label: "Video playlists",
            value: `${heldPlaylists.length} playlist${heldPlaylists.length === 1 ? "" : "s"}`,
            note: playlists.allowance != null && playlists.remaining > 0 ? `${playlists.remaining} still to choose` : "Ready to watch",
          },
          ...(membership.includesQa
            ? [
                {
                  href: "#live-q-a-with-tony",
                  label: "Live Q&A",
                  value: qa.upcoming[0] ? formatDate(qa.upcoming[0].startsAt) : "Monthly",
                  note: qa.upcoming[0] ? "Next session" : "Next date to be set",
                },
              ]
            : []),
          ...(staffOnly
            ? []
            : [
                {
                  href: "/account/pass",
                  label: membership.renews ? "Renews" : "Your pass ends",
                  value: membership.date ? formatDate(membership.date) : "No end date",
                  note: membership.renews ? "Until you cancel" : "It does not renew",
                },
              ]),
        ].map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="flex h-full flex-col rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transform-none"
            >
              <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{tile.label}</span>
              <span className="mt-2 text-xl leading-tight font-semibold">{tile.value}</span>
              <span className="mt-1 text-sm text-muted-foreground">{tile.note}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="space-y-16">
        <AccountSection
          className="scroll-mt-24"
          title="Group Coaching"
          action={
            <Link href="/academy/coaching" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Your sessions
            </Link>
          }
        >
          {/* A pass holder takes a series as a buyer does: by registering for a
              run of it, for a seat in all eight sessions (migration 0018). The
              tier sets how many in the year. */}
          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            Register for a series and your seat is kept in all eight sessions, with nothing to book. Pass holders can
            register before it opens to everyone.
          </p>

          {/* How many of the year's series are taken, as a row of marks. */}
          {series.allowance != null ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: series.allowance }, (_, i) => (
                  <span key={i} className={`h-2.5 w-10 rounded-full ${i < series.used ? "bg-accent" : "bg-surface-muted ring-1 ring-border"}`} />
                ))}
              </p>
              <p className="text-sm font-medium">
                {series.used} of {series.allowance} series taken this year
                <span className="font-normal text-muted-foreground">
                  {seriesLeft === 0 ? " · none left" : ` · ${seriesLeft} left to take`}
                </span>
              </p>
            </div>
          ) : null}

          <div className="mt-8 space-y-10">
            {series.registered.length > 0 ? (
              <AccountGroup title="Your series" count={series.registered.length}>
                <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                  {series.registered.map((r) => (
                    <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
                      <div className="min-w-0">
                        <p className="font-medium">{r.seriesName}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {r.label} · {formatDate(r.startsAt)} to {formatDate(r.endsAt)}
                        </p>
                      </div>
                      <ButtonLink href="/academy/coaching" size="sm" variant="outline" className="shrink-0 self-start sm:self-auto">
                        See the sessions
                      </ButtonLink>
                    </li>
                  ))}
                </ul>
              </AccountGroup>
            ) : null}

            <AccountGroup title="Open to register" count={seriesLeft === 0 ? undefined : series.open.length}>
              {seriesLeft === 0 ? (
                <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                  You have taken all the series in your pass for this year. More can be bought on each series&apos; page.
                </p>
              ) : series.open.length > 0 && staffOnly ? (
                <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                  {series.open.map((r) => (
                    <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
                      <div className="min-w-0">
                        <p className="font-medium">{r.seriesName}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {r.label} · {formatDate(r.startsAt)} to {formatDate(r.endsAt)} · {r.placesLeft} place
                          {r.placesLeft === 1 ? "" : "s"} left
                        </p>
                      </div>
                      <StaffOnly />
                    </li>
                  ))}
                </ul>
              ) : series.open.length > 0 ? (
                <RunChooser
                  runs={series.open.map((r) => ({
                    id: r.id,
                    label: `${r.seriesName} · ${r.label}`,
                    dates: `${formatDate(r.startsAt)} to ${formatDate(r.endsAt)}`,
                    placesLeft: r.placesLeft,
                    // Pass holders register first (migration 0026).
                    note: r.opensToAll ? `Early registration for pass holders. Opens to everyone on ${formatDate(r.opensToAll)}` : undefined,
                    uses:
                      series.allowance == null
                        ? `This is one of the series your ${membership.tierName} includes.`
                        : `This uses one of the ${series.allowance} series in your ${membership.tierName} for the year. You will have ${Math.max((seriesLeft ?? 1) - 1, 0)} left.`,
                  }))}
                />
              ) : (
                <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No series is open for registration at the moment. Each one opens to pass holders ahead of everyone
                  else; it will appear here as soon as it does.
                </p>
              )}
            </AccountGroup>
          </div>
        </AccountSection>

        {/* The playlists have a section of their own in the Academy now
            (owner, 2026-10-10); here, what the pass gives and the way there. */}
        <AccountSection className="scroll-mt-24" title="Video playlists">
          <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
            <div className="min-w-0">
              <p className="font-medium">
                {heldPlaylists.length > 0
                  ? heldPlaylists.map((p) => p.name).join(" · ")
                  : "Choose your playlist"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {playlists.allowance != null && playlists.remaining > 0
                  ? `Your pass includes ${playlists.allowance === 1 ? "one playlist" : `${playlists.allowance} playlists`} of your choice. Choose it under Playlists.`
                  : "New videos appear in your playlists as they are added."}
              </p>
            </div>
            <ButtonLink href="/academy/playlists" size="sm" className="shrink-0 self-start sm:self-auto">
              {playlists.allowance != null && playlists.remaining > 0 ? "Choose a playlist" : "Open playlists"}
            </ButtonLink>
          </div>
        </AccountSection>

        {membership.includesQa ? (
          <AccountSection className="scroll-mt-24" title="Live Q&A with Tony">
            <p className="mb-6 max-w-2xl leading-relaxed text-muted-foreground">
              An hour with Tony every month, live. Send your questions in beforehand; the recording is here afterwards.
            </p>
            {qa.upcoming.length > 0 ? (
              <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                {qa.upcoming.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center gap-4 p-4">
                    <DateBadge value={q.startsAt} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.title}</p>
                      <p className="text-sm text-muted-foreground">{formatSlot(q.startsAt, q.endsAt)}</p>
                      {q.description ? <p className="mt-1 text-sm text-muted-foreground">{q.description}</p> : null}
                    </div>
                    {staffOnly ? <StaffOnly /> : <JoinAction join={q.join} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                The next Q&amp;A has not been scheduled yet. It will appear here, with its joining link, as soon as it is.
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Have a question for Tony?{" "}
              <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                Send it in beforehand
              </Link>{" "}
              and it will be answered on the day.
            </p>

            {qa.past.length > 0 ? (
              <AccountGroup title="Recordings" count={qa.past.length} className="mt-10">
                <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                  {qa.past.map((q) => (
                    <li key={q.id} className="flex flex-wrap items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{q.title}</p>
                        <p className="text-sm text-muted-foreground">{formatSlot(q.startsAt)}</p>
                      </div>
                      <RecordingAction recording={q.recording} />
                    </li>
                  ))}
                </ul>
              </AccountGroup>
            ) : null}
          </AccountSection>
        ) : null}
      </div>
    </>
  );
}
