import type { Metadata } from "next";
import Link from "next/link";

import { AccountGroup, AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { AcademyLanding } from "@/components/academy/AcademyLanding";
import { CohortCard } from "@/components/academy/CohortCard";
import { CourseCard } from "@/components/academy/CourseCard";
import { ProgressBar } from "@/components/academy/ProgressBar";
import { DateBadge, JoinAction } from "@/components/academy/SessionParts";
import { StaffOnly } from "@/components/academy/StaffView";
import { StoredImage } from "@/components/media/StoredImage";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile, type IconName } from "@/components/ui/Icon";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  myCohorts,
  myCourses,
  progressAcrossCourses,
  sessionCredits,
} from "@/lib/academy";
import { groupBy } from "@/lib/utils/group";
import { myMembership } from "@/lib/academy/membership";
import { academyStaffView, allCohorts, allCourses } from "@/lib/academy/staff";
import { myCoaching, myQaSessions, nextWorkshops, sessionGroup } from "@/lib/academy/delivery";
import { formatSlot, greetingFor } from "@/lib/academy/format";
import { myProfile } from "@/lib/account";
import { formatDate } from "@/lib/account/format";
import { getAuthContext } from "@/lib/permissions";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * A guest gets the public landing page, which is worth finding in search, so
 * it is indexable with a description written for newcomers. The signed-in
 * dashboard is personal and stays out of the index.
 */
export async function generateMetadata(): Promise<Metadata> {
  const context = await getAuthContext();
  if (!context) {
    return pageMetadata({
      title: "Academy",
      description:
        "Tony Klinger's courses, live cohort workshops and Group Coaching, all under one account, with your progress kept for you.",
      path: "/academy",
    });
  }
  return { title: "Academy", robots: { index: false } };
}

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
 *   3. What I have            the Coaching Pass on its own line, then courses and cohorts
 *
 * No count tiles ("Courses: 2"): the owner rejects decorative counts site-wide
 * and the sections below show the things themselves (note 10, Account overview).
 */
export default async function AcademyPage() {
  const context = await getAuthContext();
  if (!context) return <AcademyLanding />;

  const staffView = await academyStaffView();
  const [courses, progress, credits, membership, ownCohorts, everyCohort, coaching, workshops, profile, qa] =
    await Promise.all([
      // Staff view (note 06 §23.2): every course and cohort, not only their own.
      staffView ? allCourses() : myCourses(),
      progressAcrossCourses(),
      sessionCredits(),
      myMembership(),
      myCohorts(),
      staffView ? allCohorts() : Promise.resolve(null),
      myCoaching(),
      nextWorkshops(3),
      myProfile(),
      // Empty for anyone whose pass does not include the Q&A (RLS).
      myQaSessions(),
    ]);

  const firstName = profile?.first_name?.trim() || profile?.display_name?.trim().split(" ")[0];
  const greeting = greetingFor();
  const cohorts = everyCohort ?? ownCohorts;
  const hasAnything =
    staffView || courses.length > 0 || credits !== null || membership !== null || cohorts.length > 0;

  // Joining is for people in the session. In the staff view a workshop or Q&A
  // the staff member holds no place in is listed without its link.
  const ownCohortSlugs = new Set(ownCohorts.map((c) => c.slug));
  const qaViewOnly = staffView && !membership?.includesQa;

  const progressBySlug = new Map(progress.map((p) => [p.slug, p]));

  // The course to resume: one already under way beats one not yet started;
  // a finished course is never the thing to "continue".
  const resumable = courses
    .map((c) => ({ course: c, p: progressBySlug.get(c.slug) }))
    .filter((x) => x.p && !x.p.done && x.p.resume);
  // Not in the staff view: progress is kept only for people who hold a course.
  const resume = staffView
    ? null
    : (resumable.find((x) => x.p!.completed > 0) ?? resumable[0] ?? null);

  // One timeline of what's coming: booked coaching and cohort workshops.
  const upcoming = [
    ...coaching.booked.map((s) => ({
      key: `s-${s.id}`,
      title: s.title,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      // "Producing · single session" where it is one session bought for its
      // date, so it does not read as holding the series (owner, 2026-10-10).
      context: sessionGroup(s),
      join: s.join,
      viewOnly: false,
      href: "/academy/coaching",
    })),
    ...workshops.map((w) => ({
      key: `w-${w.id}`,
      title: w.title,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      context: w.cohortName ?? "Cohort workshop",
      ...(staffView && !(w.cohortSlug && ownCohortSlugs.has(w.cohortSlug))
        ? { join: null, viewOnly: true }
        : { join: w.join, viewOnly: false }),
      href: w.cohortSlug ? `/academy/cohorts/${w.cohortSlug}` : "/academy/cohorts",
    })),
  ]
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 4);

  // THE NEXT Q&A IS ALWAYS HERE (owner, 2026-10-10: "do what's best" in place
  // of a menu section of its own). It is one date a month that nobody goes
  // looking for, so it is put where people look for what is next, whatever
  // else is coming, rather than competing for one of the four places above.
  const nextQa = qa.upcoming[0];
  if (nextQa) {
    upcoming.push({
      key: `q-${nextQa.id}`,
      title: nextQa.title,
      startsAt: nextQa.startsAt,
      endsAt: nextQa.endsAt,
      context: "Live Q&A with Tony",
      join: qaViewOnly ? null : nextQa.join,
      viewOnly: qaViewOnly,
      href: "/academy/pass#live-q-a-with-tony",
    });
  }

  return (
    <>
      <AccountHeader
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={
          hasAnything
            ? "Everything you're learning, and everything coming up, in one place."
            : "You're signed in. Your Academy fills up the moment you have a Coaching Pass, a course, a cohort place or coaching."
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

          {/*
            THE COACHING PASS, ON A LINE OF ITS OWN (owner, 2026-10-09). It sat
            in a narrow column beside "Coming up", above a "Session credits"
            tile. That tile is gone: sessions are not held as credits to spend
            any more — a series is registered for and a single session is
            bought for its date — so it only ever said "None".
          */}
          <section aria-labelledby="pass-title">
            <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <IconTile name="star" tone={membership || staffView ? "accent" : "neutral"} />
                <div className="min-w-0">
                  <h2 id="pass-title" className="font-sans text-sm font-normal text-muted-foreground">
                    Coaching Pass
                  </h2>
                  <p className={`font-display text-2xl leading-tight font-semibold ${membership || staffView ? "" : "text-muted-foreground"}`}>
                    {membership ? membership.tierName : staffView ? "Everything, view only" : "None"}
                  </p>
                  {membership?.date ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {membership.renews ? "Renews" : "Ends"} {formatDate(membership.date)}
                    </p>
                  ) : null}
                </div>
              </div>
              <ButtonLink
                href={membership || staffView ? "/academy/pass" : "/coaching/passes"}
                size="sm"
                variant={membership || staffView ? "primary" : "outline"}
                className="shrink-0 self-start sm:self-auto"
              >
                {membership ? "Open your pass" : staffView ? "Open the pass" : "Compare the passes"}
              </ButtonLink>
            </div>
          </section>

          <div>
            <AccountSection
              title="Coming up"
              className="min-w-0"
              action={
                upcoming.length ? (
                  <Link href="/academy/coaching" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    All sessions
                  </Link>
                ) : null
              }
            >
              {upcoming.length ? (
                // By series or cohort (owner, 2026-10-09), each in date order.
                <div className="space-y-6">
                  {groupBy(upcoming, (item) => item.context).map((g) => (
                    <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                      <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                        {g.items.map((item) => (
                          <li key={item.key} className="flex flex-wrap items-center gap-4 p-4">
                            <DateBadge value={item.startsAt} />
                            <div className="min-w-0 flex-1">
                              <Link href={item.href} className="font-medium hover:underline hover:underline-offset-4">
                                {item.title}
                              </Link>
                              <p className="text-sm text-muted-foreground">{formatSlot(item.startsAt, item.endsAt)}</p>
                            </div>
                            {item.join ? <JoinAction join={item.join} /> : item.viewOnly ? <StaffOnly /> : null}
                          </li>
                        ))}
                      </ul>
                    </AccountGroup>
                  ))}
                </div>
              ) : credits && credits.remaining > 0 ? (
                <div className="flex flex-col gap-4 rounded-(--radius-lg) border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Nothing booked yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You have {credits.remaining} session{credits.remaining === 1 ? "" : "s"} paid for and waiting for a date.
                    </p>
                  </div>
                  <ButtonLink href="/academy/coaching" size="sm">
                    Choose a date
                  </ButtonLink>
                </div>
              ) : (
                <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                  Nothing scheduled. Your series, workshops and the next Q&amp;A appear here.
                </p>
              )}
            </AccountSection>

          </div>

          <AccountSection
            title={staffView ? "Courses" : "Your courses"}
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
                    <CourseCard course={course} progress={staffView ? null : (progressBySlug.get(course.slug) ?? null)} />
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
                No courses yet. Courses you buy, or that come with a Coaching Pass, appear here.
              </p>
            )}
          </AccountSection>

          {cohorts.length ? (
            <AccountSection
              title={staffView ? "Cohorts" : "Your cohorts"}
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
          <p className="font-display text-2xl font-semibold">Coaching, every month</p>
          <p className="mt-1 text-block-foreground/80">Group Coaching, a growing video library and a monthly Q&amp;A with Tony.</p>
        </div>
        <ButtonLink href="/coaching/passes" variant="onBlock">
          Compare the passes
        </ButtonLink>
      </div>
    </div>
  );
}
