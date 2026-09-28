import type { Metadata } from "next";
import Link from "next/link";

import { AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { AcademyLanding } from "@/components/academy/AcademyLanding";
import { CohortCard } from "@/components/academy/CohortCard";
import { CourseCard } from "@/components/academy/CourseCard";
import { ProgressBar } from "@/components/academy/ProgressBar";
import { DateBadge, JoinAction } from "@/components/academy/SessionParts";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile, type IconName } from "@/components/ui/Icon";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  myCohorts,
  myCourses,
  myMembership,
  progressAcrossCourses,
  sessionCredits,
} from "@/lib/academy";
import { myCoaching, nextWorkshops } from "@/lib/academy/delivery";
import { formatSlot, greetingFor } from "@/lib/academy/format";
import { myProfile } from "@/lib/account";
import { formatDate } from "@/lib/account/format";
import { getAuthContext } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Academy",
  description: "Your courses, coaching and cohorts.",
  robots: { index: false },
};

/**
 * Academy entry — three renderings (note 03 §18, R14):
 *
 *   no session             -> public landing with a sign-in entry point
 *   session, nothing owned -> the three areas, each pointing at where to get it
 *   session, entitled      -> the personalised dashboard (note 07 §33)
 *
 * The dashboard answers, in order, what someone opens the Academy to do:
 *
 *   1. Carry on learning      the course under way and its next lesson, one press away
 *   2. What's coming up       booked coaching and cohort workshops, joinable in the window
 *   3. What I have            courses and cohorts, with membership and credits beside them
 *
 * No count tiles ("Courses: 2"): the owner rejects decorative counts site-wide
 * and the sections below show the things themselves (note 10, Account overview).
 */
export default async function AcademyPage() {
  const context = await getAuthContext();
  if (!context) return <AcademyLanding />;

  const [courses, progress, credits, membership, cohorts, coaching, workshops, profile] =
    await Promise.all([
      myCourses(),
      progressAcrossCourses(),
      sessionCredits(),
      myMembership(),
      myCohorts(),
      myCoaching(),
      nextWorkshops(3),
      myProfile(),
    ]);

  const firstName = profile?.first_name?.trim() || profile?.display_name?.trim().split(" ")[0];
  const greeting = greetingFor();
  const hasAnything =
    courses.length > 0 || credits !== null || membership !== null || cohorts.length > 0;

  const progressBySlug = new Map(progress.map((p) => [p.slug, p]));

  // The course to resume: one already under way beats one not yet started;
  // a finished course is never the thing to "continue".
  const resumable = courses
    .map((c) => ({ course: c, p: progressBySlug.get(c.slug) }))
    .filter((x) => x.p && !x.p.done && x.p.resume);
  const resume =
    resumable.find((x) => x.p!.completed > 0) ?? resumable[0] ?? null;

  // One timeline of what's coming: booked coaching and cohort workshops.
  const upcoming = [
    ...coaching.booked.map((s) => ({
      key: `s-${s.id}`,
      title: s.title,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      context: s.seriesName ?? "Group Coaching",
      join: s.join,
      href: "/academy/coaching",
    })),
    ...workshops.map((w) => ({
      key: `w-${w.id}`,
      title: w.title,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      context: w.cohortName ?? "Cohort workshop",
      join: w.join,
      href: w.cohortSlug ? `/academy/cohorts/${w.cohortSlug}` : "/academy/cohorts",
    })),
  ]
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 4);

  return (
    <>
      <AccountHeader
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={
          hasAnything
            ? "Everything you're learning, and everything coming up, in one place."
            : "You're signed in. Your Academy fills up the moment you have a course, a cohort place or coaching."
        }
      />

      {!hasAnything ? (
        <ExploreAreas />
      ) : (
        <div className="space-y-14 sm:space-y-16">
          {resume ? (
            <Reveal as="section" aria-labelledby="resume">
              <div className="relative isolate overflow-hidden rounded-(--radius-lg) bg-block-noir p-6 text-block-foreground shadow-lift sm:p-8">
                {resume.course.storagePath ? (
                  <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-full sm:w-3/5">
                    <StoredImage path={resume.course.storagePath} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="opacity-40" />
                    <div className="absolute inset-0 bg-linear-to-r from-block-noir via-block-noir/80 to-block-noir/20" />
                  </div>
                ) : null}
                <Eyebrow id="resume">
                  {resume.p!.completed > 0 ? "Pick up where you left off" : "Ready when you are"}
                </Eyebrow>
                <p className="mt-4 max-w-2xl font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
                  {resume.course.title}
                </p>
                <p className="mt-3 text-block-foreground/80">
                  {resume.p!.completed > 0 ? "Next lesson" : "First lesson"}:{" "}
                  <span className="text-block-foreground">{resume.p!.resume!.title}</span>
                </p>
                <div className="mt-6 flex max-w-md items-center gap-3">
                  <ProgressBar completed={resume.p!.completed} total={resume.p!.total} onBlock />
                  <span className="shrink-0 text-sm text-block-foreground/75 tabular-nums">
                    {resume.p!.completed} of {resume.p!.total}
                  </span>
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink
                    href={`/academy/courses/${resume.course.slug}/lessons/${resume.p!.resume!.slug}`}
                    variant="onBlock"
                  >
                    {resume.p!.completed > 0 ? "Continue lesson" : "Start the course"}
                    <span aria-hidden="true">&rarr;</span>
                  </ButtonLink>
                  <ButtonLink href={`/academy/courses/${resume.course.slug}`} variant="onBlockOutline">
                    Course overview
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
          ) : null}

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
            <AccountSection
              title="Coming up"
              className="min-w-0"
              action={
                upcoming.length ? (
                  <Link href="/account/bookings" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    All bookings
                  </Link>
                ) : null
              }
            >
              {upcoming.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                  {upcoming.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-center gap-4 p-4">
                      <DateBadge value={item.startsAt} />
                      <div className="min-w-0 flex-1">
                        <Link href={item.href} className="font-medium hover:underline hover:underline-offset-4">
                          {item.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {formatSlot(item.startsAt, item.endsAt)} · {item.context}
                        </p>
                      </div>
                      {item.join ? <JoinAction join={item.join} /> : null}
                    </li>
                  ))}
                </ul>
              ) : credits && credits.remaining > 0 ? (
                <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Nothing booked yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You have {credits.remaining} session credit{credits.remaining === 1 ? "" : "s"} waiting to be used.
                    </p>
                  </div>
                  <ButtonLink href="/academy/coaching" size="sm">
                    Book a session
                  </ButtonLink>
                </div>
              ) : (
                <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                  Nothing scheduled. Booked coaching and cohort workshops appear here.
                </p>
              )}
            </AccountSection>

            <div className="space-y-5">
              <StatusCard
                icon="star"
                label="Membership"
                value={membership ? (membership.membership_tier ?? membership.status) : "None"}
                muted={!membership}
                note={
                  membership?.current_period_end
                    ? `${membership.status === "active" ? "Renews" : "Ends"} ${formatDate(membership.current_period_end)}`
                    : undefined
                }
                href={membership ? "/account/memberships" : "/coaching/memberships"}
                linkLabel={membership ? "Manage" : "Compare tiers"}
              />
              <StatusCard
                icon="chat"
                label="Session credits"
                value={credits ? String(credits.remaining) : "None"}
                muted={!credits || credits.remaining === 0}
                note={credits ? (credits.remaining > 0 ? "Ready to book" : "All used") : undefined}
                href={credits && credits.remaining > 0 ? "/academy/coaching" : "/coaching/group-coaching"}
                linkLabel={credits && credits.remaining > 0 ? "Book a session" : "Get coaching"}
              />
            </div>
          </div>

          <AccountSection
            title="Your courses"
            action={
              <Link
                href={courses.length ? "/academy/courses" : "/coaching/courses"}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {courses.length ? "All courses" : "Browse courses"}
              </Link>
            }
          >
            {courses.length ? (
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course, index) => (
                  <Reveal as="li" key={course.id} delay={index * 60}>
                    <CourseCard course={course} progress={progressBySlug.get(course.slug) ?? null} />
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                No courses yet. Courses you buy, or that come with a membership, appear here.
              </p>
            )}
          </AccountSection>

          {cohorts.length ? (
            <AccountSection
              title="Your cohorts"
              action={
                <Link href="/academy/cohorts" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  All cohorts
                </Link>
              }
            >
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {cohorts.map((cohort, index) => (
                  <Reveal as="li" key={cohort.id} delay={index * 60}>
                    <CohortCard cohort={cohort} />
                  </Reveal>
                ))}
              </ul>
            </AccountSection>
          ) : null}
        </div>
      )}
    </>
  );
}

function StatusCard({
  icon,
  label,
  value,
  note,
  href,
  linkLabel,
  muted = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  note?: string;
  href: string;
  linkLabel: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <IconTile name={icon} tone={muted ? "neutral" : "accent"} size="sm" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      {/* Aligned with the label's text, not the tile beside it. */}
      <div className="pl-11">
      <p className={`mt-1 font-display text-2xl font-semibold capitalize ${muted ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      <Link href={href} className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
        {linkLabel}
      </Link>
      </div>
    </div>
  );
}

/** Signed in, nothing held: the three areas, each with where to get it. */
function ExploreAreas() {
  const areas = [
    {
      title: "Courses",
      icon: "play" as IconName,
      blurb: "Self-paced lessons from Tony, from first steps in the industry to getting your film made.",
      href: "/coaching/courses",
      cta: "Browse courses",
    },
    {
      title: "Cohorts",
      icon: "users" as IconName,
      blurb: "Live workshops with a small, fixed group, with recordings to go back to.",
      href: "/coaching/cohorts",
      cta: "Explore cohorts",
    },
    {
      title: "Group Coaching",
      icon: "chat" as IconName,
      blurb: "Book seats in live coaching sessions and bring your own project to the table.",
      href: "/coaching/group-coaching",
      cta: "See Group Coaching",
    },
  ];
  return (
    <div className="space-y-8">
      <ul className="grid gap-6 md:grid-cols-3">
        {areas.map((a, i) => (
          <Reveal
            as="li"
            key={a.title}
            delay={i * 70}
            className="flex flex-col rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card"
          >
            <IconTile name={a.icon} tone="accent" size="lg" className="mb-4" />
            <h2 className="font-display text-xl">{a.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{a.blurb}</p>
            <Link href={a.href} className="mt-5 text-sm font-medium text-accent underline-offset-4 hover:underline">
              {a.cta} &rarr;
            </Link>
          </Reveal>
        ))}
      </ul>
      <div className="flex flex-col gap-4 rounded-(--radius-lg) bg-block-noir p-6 text-block-foreground sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="font-display text-2xl font-semibold">Everything in one membership</p>
          <p className="mt-1 text-block-foreground/80">Courses, coaching and more, from Silver to Ultimate.</p>
        </div>
        <ButtonLink href="/coaching/memberships" variant="onBlock">
          Compare memberships
        </ButtonLink>
      </div>
    </div>
  );
}
