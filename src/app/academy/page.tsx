import type { Metadata } from "next";
import Link from "next/link";

import { CourseCard } from "@/components/academy/CourseCard";
import { Band } from "@/components/layout/Band";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import {
  Card,
  CardBody,
  CardLink,
  CardMedia,
  CardTitle,
} from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  myCohorts,
  myCourses,
  myMembership,
  progressAcrossCourses,
  sessionCredits,
} from "@/lib/academy";
import { myBookingsByTime } from "@/lib/bookings";
import { getAuthContext } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Academy",
  description: "Your courses, coaching and resources.",
  robots: { index: false },
};

/**
 * Academy entry — three renderings (note 03 §18, R14):
 *
 *   no session            -> public landing with a sign-in entry point
 *   session, nothing owned -> dashboard with an empty state pointing at /coaching
 *   session, entitled      -> dashboard showing only entitled areas
 *
 * Organised around the four Academy areas (note 04 §9): Courses, Cohorts and
 * Coaching each get a tile and, where the customer holds something, a
 * section below; Membership and Session credits sit alongside them as the
 * two facts that govern access to all three rather than a section of their
 * own. Masterclasses and standalone Resources were both removed the same
 * day they were built — Masterclasses folds into Courses conceptually,
 * Resources are delivered inside whichever course, cohort or coaching
 * session they belong to (see `src/lib/academy/index.ts`).
 */
export default async function AcademyPage() {
  const context = await getAuthContext();

  if (!context) return <AcademyLanding />;

  const [courses, progress, bookings, credits, membership, cohorts] = await Promise.all([
    myCourses(),
    progressAcrossCourses(),
    myBookingsByTime(),
    sessionCredits(),
    myMembership(),
    myCohorts(),
  ]);
  const upcomingBookings = bookings.upcoming.slice(0, 3);

  const hasAnything =
    courses.length > 0 || credits !== null || membership !== null || cohorts.length > 0;
  const progressBySlug = new Map(progress.map((p) => [p.slug, p]));

  return (
    <>
      <PageHeader
        title="Your Academy"
        description={
          hasAnything
            ? "Everything you have access to, in one place."
            : "You're signed in — this fills up as soon as you have something."
        }
      />

      {!hasAnything ? (
        <EmptyState
          title="Nothing here yet"
          description="Courses, coaching and memberships appear here the moment they're yours."
          action={<ButtonLink href="/coaching">Explore coaching</ButtonLink>}
        />
      ) : (
        <div className="space-y-10">
          {/*
            Every area the Academy offers gets a tile here, held or not — an
            empty tile states that plainly and points at where to get it,
            rather than only appearing once somebody happens to hold one.
          */}
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MembershipTile membership={membership} />
            <CreditsTile credits={credits} />
            <CountTile
              delay={120}
              label="Courses"
              count={courses.length}
              ownedHref="/academy/courses"
              ownedLabel="View all"
              browseHref="/coaching/courses"
              browseLabel="Browse courses"
            />
            <CountTile
              delay={150}
              label="Cohorts"
              count={cohorts.length}
              ownedHref="/academy/cohorts"
              ownedLabel="View all"
              browseHref="/coaching/cohorts"
              browseLabel="Explore cohorts"
            />
          </dl>

          {courses.length > 0 ? (
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold">
                  Continue learning
                </h2>
                <Link
                  href="/academy/courses"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  All courses
                </Link>
              </div>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course, index) => (
                  <Reveal as="li" key={course.id} delay={index * 60}>
                    <CourseCard
                      course={course}
                      progress={progressBySlug.get(course.slug) ?? null}
                    />
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingBookings.length > 0 ? (
            /*
              This is CONFIRMED bookings — a reservation, not merely a session
              your credits could reach. It was reading the bookable SCHEDULE
              instead (`upcomingSessions()`), so it showed every entitled
              session as though already booked, with no way to tell the two
              apart, while still linking to "All bookings" as if it agreed
              with that page. `myBookingsByTime()` is what `/account/bookings`
              itself reads, so the two now show the same thing (note 09 §29).
              Booking a NEW session is `/academy/coaching`'s job, not this
              widget's — see the nudge below when nothing is booked yet.
            */
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold">Coming up</h2>
                <Link
                  href="/account/bookings"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  All bookings
                </Link>
              </div>
              <ul className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                {upcomingBookings.map((b, index) => {
                  const date = new Date(b.starts_at!);
                  return (
                    <li
                      key={b.id}
                      className={
                        index > 0
                          ? "flex items-center gap-4 border-t border-border p-4"
                          : "flex items-center gap-4 p-4"
                      }
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-(--radius) bg-accent/10 text-accent">
                        <span className="text-[0.625rem] font-semibold tracking-wide uppercase">
                          {date.toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                        <span className="text-lg leading-none font-semibold">
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {b.title ?? b.bookable_type.replace(/_/g, " ")}
                        </p>
                        {b.seriesName ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {b.seriesName}
                          </p>
                        ) : null}
                      </div>
                      <time
                        dateTime={b.starts_at!}
                        className="shrink-0 text-sm text-muted-foreground"
                      >
                        {date.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : credits && credits.remaining > 0 ? (
            // Held credits, nothing reserved yet — the gap this dashboard
            // exists to close, not a state to render as though there were
            // simply nothing here.
            <section className="rounded-(--radius-lg) border border-border bg-surface p-5">
              <p className="font-medium">
                You have {credits.remaining} session credit{credits.remaining === 1 ? "" : "s"}{" "}
                waiting to be used
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing booked yet — pick a date from your entitled coaching.
              </p>
              <ButtonLink href="/academy/coaching" size="sm" className="mt-4">
                Book a session
              </ButtonLink>
            </section>
          ) : null}

          {cohorts.length > 0 ? (
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold">Your cohorts</h2>
                <Link
                  href="/academy/cohorts"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  All cohorts
                </Link>
              </div>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cohorts.map((cohort, index) => (
                  <Reveal as="li" key={cohort.id} delay={index * 60}>
                    <CohortCard cohort={cohort} />
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

function CountTile({
  label,
  count,
  ownedHref,
  ownedLabel,
  browseHref,
  browseLabel,
  delay,
}: {
  label: string;
  count: number;
  ownedHref: string;
  ownedLabel: string;
  browseHref: string;
  browseLabel: string;
  delay: number;
}) {
  return (
    <Reveal
      as="div"
      delay={delay}
      className="rounded-(--radius-lg) border border-border bg-surface p-5"
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-semibold">{count}</dd>
      <Link
        href={count > 0 ? ownedHref : browseHref}
        className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        {count > 0 ? ownedLabel : browseLabel}
      </Link>
    </Reveal>
  );
}

function CohortCard({
  cohort,
}: {
  cohort: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cohortLevel: "silver" | "gold" | "platinum";
    startsAt: string | null;
    storagePath: string | null;
  };
}) {
  return (
    <Card interactive className="h-full">
      <CardMedia ratio="16/9">
        {cohort.storagePath ? (
          <StoredImage
            path={cohort.storagePath}
            alt={cohort.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <GeneratedCover title={cohort.name} seed={cohort.slug} showTitle={false} />
        )}
      </CardMedia>
      <CardBody>
        <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {cohort.cohortLevel} level
        </p>
        <CardTitle className="mt-1.5 text-lg">
          <CardLink href={`/coaching/cohorts/${cohort.slug}`}>{cohort.name}</CardLink>
        </CardTitle>
        <p className="mt-3 text-xs text-muted-foreground">
          {cohort.startsAt
            ? `Starts ${new Date(cohort.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
            : "Schedule to be announced"}
        </p>
      </CardBody>
    </Card>
  );
}

function MembershipTile({
  membership,
}: {
  membership: { status: string; membership_tier: string | null; current_period_end: string | null } | null;
}) {
  return (
    <Reveal
      as="div"
      delay={60}
      className="rounded-(--radius-lg) border border-border bg-surface p-5"
    >
      <dt className="text-sm text-muted-foreground">Membership</dt>
      {membership ? (
        <>
          <dd className="mt-1 font-display text-3xl font-semibold capitalize">
            {membership.membership_tier ?? membership.status}
          </dd>
          {membership.current_period_end ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {membership.status === "active" ? "Renews" : "Ends"}{" "}
              {new Date(membership.current_period_end).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : null}
          <Link
            href="/account/membership"
            className="mt-1 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Manage
          </Link>
        </>
      ) : (
        <>
          <dd className="mt-1 font-display text-3xl font-semibold text-muted-foreground">
            None
          </dd>
          <Link
            href="/coaching/memberships"
            className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Compare tiers
          </Link>
        </>
      )}
    </Reveal>
  );
}

function CreditsTile({ credits }: { credits: { remaining: number } | null }) {
  return (
    <Reveal
      as="div"
      delay={90}
      className="rounded-(--radius-lg) border border-border bg-surface p-5"
    >
      <dt className="text-sm text-muted-foreground">Session credits</dt>
      <dd className="mt-1 font-display text-3xl font-semibold">
        {credits ? credits.remaining : "—"}
      </dd>
      {credits && credits.remaining > 0 ? (
        <Link
          href="/account/bookings"
          className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Book a session
        </Link>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {credits ? "None remaining" : "None held"}
        </p>
      )}
    </Reveal>
  );
}

/** Public landing — the only Academy page a guest may see (note 01 §8). */
function AcademyLanding() {
  return (
    <>
      <Band tone="teal">
        <div className="max-w-2xl space-y-5">
          <Reveal as="p" className="text-sm font-medium tracking-widest uppercase">
            The Academy
          </Reveal>
          <Reveal
            as="h1"
            delay={60}
            className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl"
          >
            Where everything you buy is delivered
          </Reveal>
          <Reveal as="p" delay={120} className="text-lg text-pretty opacity-90">
            Courses, coaching sessions and cohort workshops — all in one
            place, tied to a single account.
          </Reveal>
          <Reveal delay={180} className="flex flex-wrap gap-3">
            <ButtonLink href="/auth/sign-in?next=%2Facademy" variant="onBlock" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href="/coaching" variant="onBlockOutline" size="lg">
              See what&apos;s available
            </ButtonLink>
          </Reveal>
        </div>
      </Band>

      <Section>
        <Container>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              ["Courses", "Modules and lessons, at your own pace."],
              ["Coaching", "Book sessions from the series you hold."],
              ["Cohorts", "Workshop schedules, resources and recordings."],
            ].map(([title, blurb], index) => (
              <Reveal
                as="li"
                key={title}
                delay={index * 70}
                className="rounded-(--radius-lg) border border-border bg-surface p-6"
              >
                <h2 className="font-display text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={280} className="mt-8 text-sm text-muted-foreground">
            Access is tied to what you have bought or been granted. Signing in
            does not by itself unlock anything.
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
