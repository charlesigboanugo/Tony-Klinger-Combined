import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompleteLesson } from "@/components/academy/CompleteLesson";
import { CourseOutline } from "@/components/academy/CourseOutline";
import { LessonBody } from "@/components/academy/LessonBody";
import { LessonVideo } from "@/components/academy/LessonVideo";
import { ProgressBar } from "@/components/academy/ProgressBar";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { completedLessonIds, courseProgress, lessonBySlug } from "@/lib/academy";
import { formatDuration, readingMinutes } from "@/lib/academy/format";
import { lessonWordCount } from "@/lib/academy/lesson-markdown";
import { requireUser } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: PageProps<"/academy/courses/[courseSlug]/lessons/[lessonSlug]">): Promise<Metadata> {
  const { courseSlug, lessonSlug } = await params;
  const found = await lessonBySlug(courseSlug, lessonSlug);
  return { title: found?.lesson.title ?? "Lesson", robots: { index: false } };
}

/**
 * A lesson — note 07 §34.
 *
 * Laid out as a study room rather than an article: the course's own map sits
 * beside the lesson from `xl` (above the lesson in a disclosure below it), the
 * course progress stays in view at the top, and the step a learner takes most
 * — finish this, open the next — is one button.
 */
export default async function LessonPage({
  params,
}: PageProps<"/academy/courses/[courseSlug]/lessons/[lessonSlug]">) {
  const { courseSlug, lessonSlug } = await params;
  await requireUser(`/academy/courses/${courseSlug}/lessons/${lessonSlug}`);

  // Returns null both when the lesson does not exist and when RLS withheld it
  // for lack of entitlement — indistinguishable by design (note 06 §38).
  const found = await lessonBySlug(courseSlug, lessonSlug);
  if (!found) notFound();

  const { course, lesson, moduleTitle, previous, next } = found;

  const allIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const completed = await completedLessonIds(allIds);
  const progress = courseProgress(course, completed);
  const isComplete = completed.has(lesson.id);

  const path = `/academy/courses/${courseSlug}/lessons/${lessonSlug}`;
  const lessonHref = (slug: string) => `/academy/courses/${course.slug}/lessons/${slug}`;

  const meta = [
    lesson.videoUrl ? (lesson.videoDurationSeconds ? `Video · ${formatDuration(lesson.videoDurationSeconds)}` : "Video") : null,
    lesson.content ? `${readingMinutes(lessonWordCount(lesson.content))} min read` : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-12">
      <article className="min-w-0">
        {/* Where you are in the course, always in view at the top. */}
        <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={`/academy/courses/${course.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span aria-hidden="true">&larr;</span>
            {course.title}
          </Link>
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <ProgressBar completed={progress.completed} total={progress.total} size="sm" />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {progress.completed}/{progress.total}
            </span>
          </div>
        </div>

        <Eyebrow>{moduleTitle}</Eyebrow>
        <h1 className="mt-4 font-display text-balance">{lesson.title}</h1>
        {meta.length ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {meta.map((m, i) => (
              <span key={m} className="flex items-center gap-3">
                {i > 0 ? <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border" /> : null}
                {m}
              </span>
            ))}
            {isComplete ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                <span aria-hidden="true">&#10003;</span> Completed
              </span>
            ) : null}
          </p>
        ) : null}

        {/* Below xl the map collapses above the lesson, closed by default so
            the lesson itself is what the page opens on. */}
        <details className="group mt-8 rounded-(--radius-lg) border border-border bg-surface xl:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Course contents
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-open:rotate-180">
              <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="max-h-[60svh] overflow-y-auto overscroll-contain border-t border-border p-3">
            <CourseOutline course={course} completed={completed} currentLessonId={lesson.id} />
          </div>
        </details>

        {/* The URL reaching this point is itself the access decision — a lesson
            row is only readable with a live entitlement (migration 0002), and
            `lessonBySlug` composes the embed URL after that (note 07 §R29). */}
        {lesson.videoUrl ? (
          <LessonVideo url={lesson.videoUrl} title={lesson.title} />
        ) : null}

        <div className="mt-10 max-w-[68ch]">
          {lesson.content ? (
            <LessonBody source={lesson.content} />
          ) : lesson.videoUrl ? null : (
            <p className="text-muted-foreground">This lesson has no written content yet.</p>
          )}
        </div>

        <div className="mt-12 flex flex-col gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-medium">
              {isComplete
                ? progress.done
                  ? "You've finished the course"
                  : "Lesson complete"
                : "Finished this lesson?"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isComplete
                ? progress.done
                  ? "Every lesson is done. You can come back to any of them."
                  : `${progress.total - progress.completed} to go.`
                : next
                  ? `Up next: ${next.title}`
                  : "This is the last lesson in the course."}
            </p>
          </div>
          <CompleteLesson
            lessonId={lesson.id}
            path={path}
            complete={isComplete}
            nextHref={next ? lessonHref(next.slug) : undefined}
          />
        </div>

        <nav aria-label="Lessons" className="mt-6 grid gap-3 sm:grid-cols-2">
          {previous ? (
            <StepLink href={lessonHref(previous.slug)} label="Previous" title={previous.title} direction="back" />
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <StepLink href={lessonHref(next.slug)} label="Next" title={next.title} direction="forward" />
          ) : (
            <StepLink href={`/academy/courses/${course.slug}`} label="Finish" title="Back to the course" direction="forward" />
          )}
        </nav>
      </article>

      <aside aria-label="Course contents" className="hidden xl:block">
        <div className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto overscroll-contain pb-6">
          <p className="mb-4 px-2 text-sm font-semibold">Course contents</p>
          <CourseOutline course={course} completed={completed} currentLessonId={lesson.id} />
        </div>
      </aside>
    </div>
  );
}

function StepLink({
  href,
  label,
  title,
  direction,
}: {
  href: string;
  label: string;
  title: string;
  direction: "back" | "forward";
}) {
  const forward = direction === "forward";
  return (
    <Link
      href={href}
      className={
        "group flex flex-col gap-1 rounded-(--radius-lg) border border-border p-4 transition-colors hover:border-foreground/30 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
        (forward ? "sm:items-end sm:text-right" : "")
      }
    >
      <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {forward ? null : <span aria-hidden="true">&larr; </span>}
        {label}
        {forward ? <span aria-hidden="true"> &rarr;</span> : null}
      </span>
      <span className="font-medium text-pretty">{title}</span>
    </Link>
  );
}
