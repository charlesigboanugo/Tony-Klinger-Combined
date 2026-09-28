"use client";

import { useActionState } from "react";

import { setLessonCompleteAction, type ProgressState } from "@/app/academy/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: ProgressState = {};

/**
 * Marking a lesson done — note 07 §32.
 *
 * A form rather than a checkbox that saves on change: completion is a decision,
 * and a control that writes on a stray click gives no moment to notice. It also
 * means the whole thing works before hydration.
 *
 * Undo is the same control inverted, because a mis-click that cannot be
 * reversed turns a progress tracker into a liability.
 *
 * With a `nextHref` the one button both records the lesson and opens the next
 * — the step a learner takes forty times a course, made one press instead of
 * two. The last lesson has no next, so it simply marks complete.
 */
export function CompleteLesson({
  lessonId,
  path,
  complete,
  nextHref,
}: {
  lessonId: string;
  path: string;
  complete: boolean;
  nextHref?: string;
}) {
  const [state, action] = useActionState(setLessonCompleteAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="complete" value={complete ? "false" : "true"} />
      {nextHref && !complete ? <input type="hidden" name="next" value={nextHref} /> : null}

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}

      {complete ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-sm font-medium text-success">
            <span aria-hidden="true">&#10003;</span> Completed
          </span>
          <SubmitButton variant="ghost" pendingLabel="Updating…">
            Mark as not done
          </SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…">
          {nextHref ? (
            <>
              Complete and continue <span aria-hidden="true">&rarr;</span>
            </>
          ) : (
            "Mark as complete"
          )}
        </SubmitButton>
      )}
    </form>
  );
}
