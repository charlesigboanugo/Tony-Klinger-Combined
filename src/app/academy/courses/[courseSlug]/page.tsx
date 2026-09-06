import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { completedLessonIds, courseProgress, courseWithContent } from "@/lib/academy";
import { entitlementFor } from "@/lib/commerce/entitlements";
import { requireUser } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: PageProps<"/academy/courses/[courseSlug]">): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await courseWithContent(courseSlug);
  return { title: course?.title ?? "Course", robots: { index: false } };
}

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
    return (
      <>
        <BackLink href="/academy/courses">Your courses</BackLink>
        <PageHeader title={course.title} />
        <div className="rounded-(--radius) border border-border bg-surface p-6">
          <h2 className="font-medium">
            {entitlement.state === "expired"
              ? "Your access to this course has ended"
              : "You don't have access to this course"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {entitlement.state === "expired"
              ? "Renew to pick up where you left off — your progress is kept."
              : "This course is available to buy, or through a membership that includes it."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href={`/coaching/courses/${course.slug}`}>
              {entitlement.state === "expired" ? "Renew access" : "See this course"}
            </ButtonLink>
          </div>
        </div>
      </>
    );
  }

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const completed = await completedLessonIds(allLessons.map((l) => l.id));
  const progress = courseProgress(course, completed);

  return (
    <>
      <BackLink href="/academy/courses">Your courses</BackLink>
      <PageHeader
        title={course.title}
        description={course.description ?? undefined}
        actions={
          progress.resume ? (
            <ButtonLink
              href={`/academy/courses/${course.slug}/lessons/${progress.resume.slug}`}
            >
              {progress.completed === 0 ? "Start course" : "Continue"}
            </ButtonLink>
          ) : null
        }
      />

      {/* Counted, not estimated. "11 of 19" is a fact somebody can act on;
          a percentage is the same number made vaguer (note 07 §32). */}
      <div className="mb-10 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-medium">
            {progress.done
              ? "Course complete"
              : `${progress.completed} of ${progress.total} lessons done`}
          </p>
          {progress.resume ? (
            <p className="text-sm text-muted-foreground">
              Up next: {progress.resume.title}
            </p>
          ) : null}
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.completed}
          aria-label={`${progress.completed} of ${progress.total} lessons complete`}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-(--dur-slow) ease-expo"
            style={{
              width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <ol className="space-y-6">
        {course.modules.map((module, i) => (
          <li key={module.id}>
            <h2 className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Module {i + 1} · {module.title}
            </h2>
            <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface">
              {module.lessons.map((lesson, j) => {
                const done = completed.has(lesson.id);
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/academy/courses/${course.slug}/lessons/${lesson.slug}`}
                      className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-muted"
                    >
                      <span
                        aria-hidden="true"
                        className={
                          done
                            ? "text-success"
                            : "w-4 text-sm text-muted-foreground tabular-nums"
                        }
                      >
                        {done ? "\u2713" : j + 1}
                      </span>
                      <span className="min-w-0 flex-1 font-medium">
                        {lesson.title}
                        {/* Said in words as well, so the tick is not the only
                            carrier of the state (note 10 §21). */}
                        {done ? <span className="sr-only"> — completed</span> : null}
                      </span>
                      {lesson.hasVideo ? (
                        <span className="shrink-0 text-xs tracking-[0.08em] text-muted-foreground uppercase">
                          Video
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
