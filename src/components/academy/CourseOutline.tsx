import Link from "next/link";

import type { CourseWithContent } from "@/lib/academy";
import { formatDuration } from "@/lib/academy/format";
import { cn } from "@/lib/utils/cn";

/**
 * The course's table of contents, beside the lesson being studied — note 07
 * §34, note 04 §32.3.
 *
 * A lesson page used to show only "Lesson 7 of 20" and a previous/next pair, so
 * seeing where you were — or jumping to the lesson you wanted — meant going
 * back out to the course page. This keeps the whole map in reach: every
 * module, every lesson, what is done and which one is open.
 *
 * Unnumbered on purpose (owner, 2026-09-25: no row numbering). The state marks
 * carry the information a number would not: done, here, still to do.
 */
export function CourseOutline({
  course,
  completed,
  currentLessonId,
  className,
}: {
  course: CourseWithContent;
  completed: ReadonlySet<string>;
  currentLessonId?: string;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-5", className)}>
      {course.modules.map((module) => {
        const done = module.lessons.filter((l) => completed.has(l.id)).length;
        return (
          <li key={module.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 px-2">
              <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {module.title}
              </p>
              <p className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                {done}/{module.lessons.length}
              </p>
            </div>
            <ul className="space-y-0.5">
              {module.lessons.map((lesson) => {
                const isDone = completed.has(lesson.id);
                const isCurrent = lesson.id === currentLessonId;
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/academy/courses/${course.slug}/lessons/${lesson.slug}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        "group flex items-start gap-3 rounded-(--radius) border-l-2 px-2 py-2 text-sm transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isCurrent
                          ? "border-accent bg-accent/10 font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      <StateMark done={isDone} current={isCurrent} />
                      <span className="min-w-0 flex-1 leading-snug">
                        {lesson.title}
                        {isDone ? <span className="sr-only"> — completed</span> : null}
                      </span>
                      {lesson.durationSeconds ? (
                        <span className="shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** Filled teal check when done, a ring when open, a hollow dot otherwise. */
export function StateMark({ done, current = false }: { done: boolean; current?: boolean }) {
  if (done) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 h-4.5 w-4.5 shrink-0 rounded-full border-2",
        current ? "border-accent" : "border-border group-hover:border-foreground/40",
      )}
    />
  );
}
