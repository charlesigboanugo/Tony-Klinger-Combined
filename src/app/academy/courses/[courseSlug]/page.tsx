import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StateMark } from "@/components/academy/CourseOutline";
import { ProgressBar } from "@/components/academy/ProgressBar";
import { StoredImage } from "@/components/media/StoredImage";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { completedLessonIds, courseProgress, courseWithContent } from "@/lib/academy";
import { formatDuration } from "@/lib/academy/format";
import { entitlementFor } from "@/lib/commerce/entitlements";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  params,
}: PageProps<"/academy/courses/[courseSlug]">): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await courseWithContent(courseSlug);
  return { title: course?.title ?? "Course", robots: { index: false } };
}

/**
 * A course's home in the Academy — note 07 §34, note 04 §32.3.
 *
 * Opens on a noir title panel (the site's one colour field, note 10 §5) with
 * the course cover as a quiet backdrop rather than a photo beside the words —
 * the owner has retired split heroes (2026-09-25). The panel holds the one
 * decision a returning learner came to make: carry on from the first unfinished
 * lesson. The curriculum below is the map, module by module, each opened to its
 * lessons with their state, running time and whether they're next.
 */
export default async function AcademyCoursePage({
  params,
}: PageProps<"/academy/courses/[courseSlug]">) {
  const { courseSlug } = await params;
  await requireUser(`/academy/courses/${courseSlug}`);

  const course = await courseWithContent(courseSlug);
  if (!course) notFound();

  const entitlement = await entitlementFor("course", course.id);
  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  // A customer without entitlement gets an explanation and a way to obtain
  // access — never a bare 404 (note 03 §14). RLS has already withheld the
  // lessons, so there is nothing to leak either way.
  if (entitlement.state !== "active" || lessonCount === 0) {
    const expired = entitlement.state === "expired";
    return (
      <>
        <BackLink href="/academy/courses">Your courses</BackLink>
        <div className="relative isolate overflow-hidden rounded-(--radius-lg) bg-block-noir p-6 text-block-foreground shadow-lift sm:p-10">
          <CoverBackdrop path={course.storagePath} />
          <Eyebrow>{expired ? "Access ended" : "Not in your Academy"}</Eyebrow>
          <h1 className="mt-4 font-display text-balance">{course.title}</h1>
          <p className="measure mt-4 text-lg text-block-foreground/80 text-pretty">
            {expired
              ? "Your access to this course has ended. Renew to pick up where you left off — your progress is kept."
              : "This course is available to buy, or through a membership that includes it."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href={`/coaching/courses/${course.slug}`} variant="onBlock">
              {expired ? "Renew access" : "See this course"}
            </ButtonLink>
            <ButtonLink href="/coaching/memberships" variant="onBlockOutline">
              Compare memberships
            </ButtonLink>
          </div>
        </div>
      </>
    );
  }

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const completed = await completedLessonIds(allLessons.map((l) => l.id));
  const progress = courseProgress(course, completed);
  const resumeId = allLessons.find((l) => l.slug === progress.resume?.slug)?.id;
  const runtime = allLessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0);

  const lessonHref = (slug: string) => `/academy/courses/${course.slug}/lessons/${slug}`;

  return (
    <>
      <BackLink href="/academy/courses">Your courses</BackLink>

      <section className="relative isolate overflow-hidden rounded-(--radius-lg) bg-block-noir p-6 text-block-foreground shadow-lift sm:p-10">
        <CoverBackdrop path={course.storagePath} />
        <Eyebrow>{progress.done ? "Course complete" : progress.completed > 0 ? "In progress" : "Course"}</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-display text-balance">{course.title}</h1>
        {course.description ? (
          <p className="measure mt-4 text-lg leading-relaxed text-block-foreground/80 text-pretty">
            {course.description}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-block-foreground/70">
          {course.modules.length > 1 ? `${course.modules.length} modules · ` : ""}
          {progress.total} lessons
          {runtime > 0 ? ` · ${formatDuration(runtime)} of video` : ""}
        </p>

        {/* Counted, not estimated: "11 of 19" is a fact somebody can act on;
            a percentage is the same number made vaguer (note 07 §34.2). */}
        <div className="mt-8 max-w-xl">
          <p className="mb-2 text-sm font-medium">
            {progress.done
              ? "Every lesson done"
              : `${progress.completed} of ${progress.total} lessons done`}
          </p>
          <ProgressBar completed={progress.completed} total={progress.total} onBlock />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {progress.resume ? (
            <ButtonLink href={lessonHref(progress.resume.slug)} variant="onBlock" size="lg">
              {progress.completed === 0 ? "Start the course" : "Continue"}
              <span aria-hidden="true">&rarr;</span>
            </ButtonLink>
          ) : (
            <ButtonLink href={lessonHref(allLessons[0].slug)} variant="onBlock" size="lg">
              Review from the start
            </ButtonLink>
          )}
          {progress.resume && progress.completed > 0 ? (
            <p className="text-sm text-block-foreground/75">
              Up next: <span className="text-block-foreground">{progress.resume.title}</span>
            </p>
          ) : null}
        </div>
      </section>

      {progress.done ? (
        <div className="mt-8 flex flex-col gap-4 rounded-(--radius-lg) border border-accent/40 bg-accent/8 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-display text-xl font-semibold">Well done — you&apos;ve completed this course</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every lesson stays open to you for as long as you have access. Ready for the next step?
            </p>
          </div>
          <ButtonLink href="/coaching/courses" variant="outline" size="sm">
            Explore more courses
          </ButtonLink>
        </div>
      ) : null}

      <div className="mt-12 space-y-8">
        <h2 className="font-display text-xl sm:text-2xl">Curriculum</h2>
        {course.modules.map((module) => {
          const done = module.lessons.filter((l) => completed.has(l.id)).length;
          const holdsResume = module.lessons.some((l) => l.id === resumeId);
          return (
            <details
              key={module.id}
              open={holdsResume || course.modules.length === 1}
              className="group overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{module.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {done === module.lessons.length ? "Complete" : `${done} of ${module.lessons.length} done`}
                  </p>
                </div>
                <div className="hidden w-32 sm:block">
                  <ProgressBar completed={done} total={module.lessons.length} size="sm" />
                </div>
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                  <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>

              <ul className="divide-y divide-border border-t border-border">
                {module.lessons.map((lesson) => {
                  const isDone = completed.has(lesson.id);
                  const isNext = lesson.id === resumeId;
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={lessonHref(lesson.slug)}
                        className={cn(
                          "group/row flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted",
                          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                          isNext && "bg-accent/6",
                        )}
                      >
                        <StateMark done={isDone} current={isNext} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block leading-snug", isDone ? "text-muted-foreground" : "font-medium")}>
                            {lesson.title}
                          </span>
                          {isDone ? <span className="sr-only"> — completed</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 pt-px text-xs text-muted-foreground">
                          {isNext ? (
                            <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                              Up next
                            </span>
                          ) : null}
                          {lesson.hasVideo ? (
                            <span className="flex items-center gap-1.5">
                              <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5">
                                <path d="M3 2v8l7-4z" fill="currentColor" />
                              </svg>
                              {lesson.durationSeconds ? formatDuration(lesson.durationSeconds) : "Video"}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </>
  );
}

/** The cover, faded into the noir panel's right side as texture, not a picture. */
function CoverBackdrop({ path }: { path: string | null }) {
  if (!path) return null;
  return (
    <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-full sm:w-2/3">
      <StoredImage path={path} alt="" fill sizes="(min-width: 640px) 60vw, 100vw" className="opacity-35" />
      <div className="absolute inset-0 bg-linear-to-r from-block-noir via-block-noir/85 to-block-noir/30" />
    </div>
  );
}
