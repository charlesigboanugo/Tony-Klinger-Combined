import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompleteLesson } from "@/components/academy/CompleteLesson";
import { LessonVideo } from "@/components/academy/LessonVideo";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { completedLessonIds, lessonBySlug } from "@/lib/academy";
import { requireUser } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: PageProps<"/academy/courses/[courseSlug]/lessons/[lessonSlug]">): Promise<Metadata> {
  const { courseSlug, lessonSlug } = await params;
  const found = await lessonBySlug(courseSlug, lessonSlug);
  return { title: found?.lesson.title ?? "Lesson", robots: { index: false } };
}

export default async function LessonPage({
  params,
}: PageProps<"/academy/courses/[courseSlug]/lessons/[lessonSlug]">) {
  const { courseSlug, lessonSlug } = await params;
  await requireUser(`/academy/courses/${courseSlug}/lessons/${lessonSlug}`);

  // Returns null both when the lesson does not exist and when RLS withheld it
  // for lack of entitlement — indistinguishable by design (note 06 §38).
  const found = await lessonBySlug(courseSlug, lessonSlug);
  if (!found) notFound();

  const { course, lesson, moduleTitle, previous, next, position, total } = found;

  const completed = await completedLessonIds([lesson.id]);
  const path = `/academy/courses/${courseSlug}/lessons/${lessonSlug}`;

  return (
    <article className="max-w-3xl">
      <BackLink href={`/academy/courses/${course.slug}`}>{course.title}</BackLink>

      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {moduleTitle} · Lesson {position} of {total}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
        {lesson.title}
      </h1>

      {/* The URL reaching this point is itself the access decision — a lesson
          row is only readable with a live entitlement (migration 0004), and
          `lessonBySlug` composes the embed URL after that (note 07 §R29). */}
      {lesson.videoUrl ? (
        <LessonVideo
          url={lesson.videoUrl}
          title={lesson.title}
          durationSeconds={lesson.videoDurationSeconds}
        />
      ) : null}

      {lesson.content ? (
        <div className="mt-6 space-y-4 leading-relaxed">
          {lesson.content.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : lesson.videoUrl ? null : (
        <p className="mt-6 text-muted-foreground">
          This lesson has no written content yet.
        </p>
      )}

      <div className="mt-8 border-t border-border pt-6">
        <CompleteLesson
          lessonId={lesson.id}
          path={path}
          complete={completed.has(lesson.id)}
        />
      </div>

      <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6">
        {previous ? (
          <ButtonLink
            href={`/academy/courses/${course.slug}/lessons/${previous.slug}`}
            variant="outline"
          >
            ← {previous.title}
          </ButtonLink>
        ) : <span />}
        {next ? (
          <ButtonLink href={`/academy/courses/${course.slug}/lessons/${next.slug}`}>
            {next.title} →
          </ButtonLink>
        ) : (
          <ButtonLink href={`/academy/courses/${course.slug}`} variant="outline">
            Finish
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
