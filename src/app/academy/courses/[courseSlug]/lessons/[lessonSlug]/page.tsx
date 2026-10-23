import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonShell } from "@/components/academy/LessonShell";
import { CompleteLesson } from "@/components/academy/CompleteLesson";
import { CourseOutline } from "@/components/academy/CourseOutline";
import { LessonBody } from "@/components/academy/LessonBody";
import { LessonVideo } from "@/components/academy/LessonVideo";
import { StaffOnly } from "@/components/academy/StaffView";
import { ProgressBar } from "@/components/academy/ProgressBar";
import { BackLink } from "@/components/ui/BackLink";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { completedLessonIds, courseProgress, lessonBySlug } from "@/lib/academy";
import { formatDuration, readingMinutes } from "@/lib/academy/format";
import { lessonWordCount } from "@/lib/academy/lesson-markdown";
import { academyStaffView, viewOnly } from "@/lib/academy/staff";
import { entitlementFor } from "@/lib/commerce/entitlements";
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
 * Laid out as a study room rather than an article: a bar at the top keeps the
 * way back, the course progress and the course's own map in reach at every
 * size (the map opens from the top), and the step a learner takes most —
 * finish this, open the next — is one button.
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

  // Seen through the staff view (note 06 §23.2): the lesson, without marking
  // it done, since progress is kept only for people who hold the course.
  const [entitlement, staffView] = await Promise.all([entitlementFor("course", course.id), academyStaffView()]);
  const staffOnly = viewOnly(staffView, entitlement.state === "active");

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
    // The lesson under a bar that stays at the top: the way back, the
    // progress, and the course contents, which open from the top (LessonShell).
    <LessonShell
      outline={<CourseOutline course={course} completed={completed} currentLessonId={lesson.id} />}
      back={
        <BackLink href={`/academy/courses/${course.slug}`} inline>
          {course.title}
        </BackLink>
      }
      progress={
        <>
          <ProgressBar completed={progress.completed} total={progress.total} size="sm" />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {progress.completed}/{progress.total}
          </span>
        </>
      }
    >
      <article className="min-w-0">

        <Eyebrow>{moduleTitle}</Eyebrow>
        <h1 className="mt-4 font-display text-balance">{lesson.title}</h1>
        {/* What the lesson covers, in a sentence or two (owner, 2026-10-15). */}
        {lesson.description ? (
          <p className="mt-3 max-w-[68ch] text-lg leading-relaxed text-pretty text-muted-foreground">{lesson.description}</p>
        ) : null}
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


        {/* The URL reaching this point is itself the access decision — a lesson
            row is only readable with a live entitlement (migration 0002), and
            `lessonBySlug` composes the embed URL after that (note 07 §R29). */}
        {lesson.videoUrl ? (
          <LessonVideo url={lesson.videoUrl} title={lesson.title} />
        ) : null}

        {/* The written lesson, centred under the video; without a video it
            sits flush left with the heading (owner, 2026-10-15). */}
        <div className={(lesson.videoUrl ? "mx-auto " : "") + "mt-10 max-w-[68ch]"}>
          {lesson.content ? (
            <LessonBody source={lesson.content} />
          ) : lesson.videoUrl ? null : (
            <p className="text-muted-foreground">This lesson has no written content yet.</p>
          )}
        </div>

        {staffOnly ? (
          <div className="mt-12 flex flex-col gap-2 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-sm text-muted-foreground">
              {next ? `Up next: ${next.title}` : "This is the last lesson in the course."}
            </p>
            <StaffOnly>Progress is kept for customers</StaffOnly>
          </div>
        ) : (
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
        )}

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
    </LessonShell>
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
