"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/permissions";

/**
 * Mark a lesson finished, or unfinished — note 07 §32.
 *
 * NOT AUTHORIZED HERE. The insert policy on `lesson_progress` (migration 0037)
 * requires a live entitlement to the lesson's course, so a caller who posts a
 * lesson id they cannot see is refused by the database rather than by this
 * function remembering to check. That matters because a Server Action is a
 * public endpoint: anyone with a session can call it with any id.
 */
export type ProgressState = { error?: string };

export async function setLessonCompleteAction(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  const lessonId = formData.get("lessonId")?.toString().trim();
  const path = formData.get("path")?.toString().trim();
  const complete = formData.get("complete") === "true";

  if (!lessonId) return { error: "No lesson given." };

  const context = await requireUser(path);
  const supabase = await createClient();

  const { error } = complete
    ? await supabase
        .from("lesson_progress")
        .upsert(
          { user_id: context.userId, lesson_id: lessonId },
          { onConflict: "user_id,lesson_id" },
        )
    : await supabase
        .from("lesson_progress")
        .delete()
        .eq("user_id", context.userId)
        .eq("lesson_id", lessonId);

  if (error) {
    // The refusal an unentitled caller gets. Worded for the person who could
    // legitimately be here and has simply lost access mid-course.
    return {
      error: /policy|permission|denied/i.test(error.message)
        ? "You no longer have access to this lesson."
        : error.message,
    };
  }

  if (path) revalidatePath(path);
  // Progress has no page of its own — it is shown on the dashboard and on
  // each course's own page, so those are what need revalidating.
  revalidatePath("/academy");
  revalidatePath("/academy/courses");

  return {};
}
