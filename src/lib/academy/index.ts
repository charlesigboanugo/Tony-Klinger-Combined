import "server-only";

import { embedUrl, lessonVideo } from "@/lib/academy/video";
import { createClient } from "@/lib/supabase/server";

/**
 * Academy delivery queries — note 03 §17–§23, note 07 §32–§36.
 *
 * The Academy shows what a customer is entitled to, resolved from entitlements
 * rather than a hand-maintained list of who may see what (note 07 §32).
 *
 * Gating is layered: these queries filter for a sensible UI, and RLS refuses
 * the rows regardless. A bug here produces an empty page, never a leak.
 */

export type EnrolledCourse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  expiresAt: string | null;
  /** Cover art, if the course has one — a dashboard card falls back to a
   * generated cover rather than treating a missing image as an error. */
  storagePath: string | null;
};

/**
 * Courses this customer can actually open.
 *
 * TWO QUERIES, NOT ONE EMBED. `entitlements.resource_id` is polymorphic — it
 * points at a course, a group coaching session, or whatever `resource_type`
 * says, depending on the row — so it carries no foreign key PostgREST could
 * follow. `courses:resource_id(...)` looked like a normal embed but had
 * nothing to resolve against: it silently returned null on every row, which
 * is why this returned an empty list even for an entitlement that genuinely
 * existed (real defect, found by checking against a seeded course
 * entitlement rather than assumed correct because the query looked plausible).
 */
export async function myCourses(): Promise<EnrolledCourse[]> {
  const supabase = await createClient();

  const { data: grants } = await supabase
    .from("entitlements")
    .select("expires_at,resource_id")
    .eq("resource_type", "course")
    .eq("status", "active");

  const rows = (grants ?? []) as Array<{
    expires_at: string | null;
    resource_id: string | null;
  }>;
  const ids = rows
    .map((r) => r.resource_id)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return [];

  const expiresById = new Map(rows.map((r) => [r.resource_id, r.expires_at]));

  const { data: courses } = await supabase
    .from("courses")
    .select("id,title,slug,description,resources!cover_resource_id(storage_path)")
    .in("id", ids);

  return ((courses ?? []) as unknown as Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    resources: { storage_path: string } | null;
  }>).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    expiresAt: expiresById.get(c.id) ?? null,
    storagePath: c.resources?.storage_path ?? null,
  }));
}

export type EnrolledCohort = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cohortLevel: "silver" | "gold" | "platinum";
  startsAt: string | null;
  storagePath: string | null;
};

/**
 * Cohorts this customer holds a place in.
 *
 * Same two-query shape as `myCourses()`, for the same reason: `resource_id` is
 * polymorphic and has no foreign key an embed could follow.
 */
export async function myCohorts(): Promise<EnrolledCohort[]> {
  const supabase = await createClient();

  const { data: grants } = await supabase
    .from("entitlements")
    .select("resource_id")
    .eq("resource_type", "cohort")
    .eq("status", "active");

  const ids = ((grants ?? []) as Array<{ resource_id: string | null }>)
    .map((r) => r.resource_id)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return [];

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id,name,slug,description,cohort_level,starts_at,resources!cover_resource_id(storage_path)")
    .in("id", ids);

  return ((cohorts ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cohort_level: "silver" | "gold" | "platinum";
    starts_at: string | null;
    resources: { storage_path: string } | null;
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    cohortLevel: c.cohort_level,
    startsAt: c.starts_at,
    storagePath: c.resources?.storage_path ?? null,
  }));
}

/*
 * Masterclasses and standalone resources deliberately have no query here.
 *
 * Built once (2026-09-05) as `myMasterclasses()`/`myResources()` — full
 * entitlement resolution, an Academy nav destination each, dashboard tiles —
 * then removed the same day at the user's direction: Masterclasses folds
 * into Courses conceptually rather than staying a parallel destination, and
 * a resource is delivered as part of the course, cohort or coaching session
 * it belongs to, never an area of its own (the same rule §23 already gives
 * recordings). The `masterclass` and `resource` values stay in the
 * `entitlement_resource` enum — schema, not UI — but the migration that gave
 * `resources` an entitled-read RLS policy for the standalone case was
 * deleted rather than kept, since nothing shipped beyond this local branch
 * and there is no longer a caller for it (note 07 §22 amended accordingly).
 */

export type CourseWithContent = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  modules: Array<{
    id: string;
    title: string;
    position: number;
    lessons: Array<{
      id: string;
      title: string;
      slug: string;
      position: number;
      /** Whether there is video at all — never the address of it. */
      hasVideo: boolean;
    }>;
  }>;
};

/**
 * A course with its structure.
 *
 * Modules and lessons come back only when the caller holds a live entitlement —
 * enforced by RLS (migration 0004), not by a check here. Without entitlement
 * the course still resolves but has no content, which is what lets the page
 * distinguish "locked" from "missing".
 */
export async function courseWithContent(
  slug: string,
): Promise<CourseWithContent | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("courses")
    .select(
      "id,title,slug,description,course_modules(id,title,position,lessons(id,title,slug,position,video_provider,video_id))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!data) return null;

  const course = data as unknown as {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    course_modules: Array<{
      id: string;
      title: string;
      position: number;
      lessons: Array<{
        id: string;
        title: string;
        slug: string;
        position: number;
        video_provider: string | null;
        video_id: string | null;
      }>;
    }>;
  };

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    modules: (course.course_modules ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        lessons: (m.lessons ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          // The listing says a lesson HAS video. It never carries the id or a
          // URL: a course outline is rendered for people who may not be
          // entitled to every lesson on it, and there is no reason for the
          // address to travel with the table of contents.
          .map((l) => ({
            id: l.id,
            title: l.title,
            slug: l.slug,
            position: l.position,
            hasVideo: Boolean(l.video_provider && l.video_id),
          })),
      })),
  };
}

export async function lessonBySlug(courseSlug: string, lessonSlug: string) {
  const course = await courseWithContent(courseSlug);
  if (!course) return null;

  const flat = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title })),
  );
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select(
      "id,title,slug,content,video_provider,video_id,video_hash,video_duration_seconds",
    )
    .eq("id", flat[index].id)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    title: string;
    slug: string;
    content: string | null;
    video_provider: string | null;
    video_id: string | null;
    video_hash: string | null;
    video_duration_seconds: number | null;
  };

  /*
    The URL is composed HERE, on the far side of the RLS check that returned
    this row (migration 0004: a lesson is only readable with a live entitlement
    to its course). A null row is indistinguishable from a missing lesson, so a
    caller without access never learns whether the video exists.
  */
  const video = lessonVideo(row);

  return {
    course,
    lesson: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      videoUrl: video ? embedUrl(video) : null,
      videoDurationSeconds: row.video_duration_seconds,
    },
    moduleTitle: flat[index].moduleTitle,
    previous: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
    position: index + 1,
    total: flat.length,
  };
}

/** Upcoming sessions the customer may attend, from their entitled series. */
export async function upcomingSessions(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_coaching_sessions")
    .select("id,title,starts_at,ends_at,series_id,group_coaching_series(name,slug)")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    group_coaching_series: { name: string; slug: string } | null;
  }>;
}

/** Consumable session credits, if the customer holds any. */
export async function sessionCredits(): Promise<{ remaining: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entitlements")
    .select("quantity,quantity_used")
    .eq("resource_type", "group_coaching_session")
    .eq("status", "active")
    .not("quantity", "is", null);

  const rows = (data ?? []) as Array<{ quantity: number; quantity_used: number }>;
  if (rows.length === 0) return null;

  return {
    remaining: rows.reduce((sum, r) => sum + (r.quantity - (r.quantity_used ?? 0)), 0),
  };
}

export async function myMembership() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status,membership_tier,current_period_end")
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    (data as {
      status: string;
      membership_tier: string | null;
      current_period_end: string | null;
    } | null) ?? null
  );
}

/**
 * Which lessons of a course this person has finished — note 07 §32.
 *
 * A set of lesson ids rather than a count, because the course outline needs to
 * tick individual rows and the summary is derivable from the set. RLS restricts
 * `lesson_progress` to the caller's own rows (migration 0037), so this cannot
 * return anybody else's however it is called.
 */
export async function completedLessonIds(
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .in("lesson_id", lessonIds);

  return new Set(((data ?? []) as Array<{ lesson_id: string }>).map((r) => r.lesson_id));
}

export type CourseProgress = {
  completed: number;
  total: number;
  /** The lesson to open on "Continue" — the first unfinished one. */
  resume: { slug: string; title: string } | null;
  done: boolean;
};

/**
 * Where somebody is in a course.
 *
 * `resume` is the FIRST UNFINISHED lesson rather than the last one opened.
 * Recording "last opened" would mean writing on every page view and would send
 * a returning customer back to something they had already finished merely
 * because they glanced at it; the first gap is what they actually want.
 */
export function courseProgress(
  course: CourseWithContent,
  completed: Set<string>,
): CourseProgress {
  const flat = course.modules.flatMap((m) => m.lessons);
  const next = flat.find((l) => !completed.has(l.id));

  return {
    completed: flat.filter((l) => completed.has(l.id)).length,
    total: flat.length,
    resume: next ? { slug: next.slug, title: next.title } : null,
    done: flat.length > 0 && !next,
  };
}

/**
 * Progress across everything the customer is enrolled on — note 03 §21.
 *
 * One query for the courses and one for the completions, rather than a
 * per-course round trip: the page renders every enrolled course at once, so
 * fetching them one at a time is the same answer at N times the cost.
 */
export async function progressAcrossCourses(): Promise<
  Array<{ slug: string; title: string } & CourseProgress>
> {
  const supabase = await createClient();

  // RLS returns only courses whose modules the caller is entitled to read, so
  // this is already the enrolled set (migration 0004).
  const { data } = await supabase
    .from("courses")
    .select("id,title,slug,course_modules(id,lessons(id,title,slug,position))")
    .eq("status", "published");

  type Row = {
    id: string;
    title: string;
    slug: string;
    course_modules: Array<{
      id: string;
      lessons: Array<{ id: string; title: string; slug: string; position: number }>;
    }>;
  };

  const courses = ((data ?? []) as unknown as Row[]).filter((c) =>
    (c.course_modules ?? []).some((m) => (m.lessons ?? []).length > 0),
  );

  const everyLesson = courses.flatMap((c) =>
    (c.course_modules ?? []).flatMap((m) => m.lessons ?? []),
  );
  const completed = await completedLessonIds(everyLesson.map((l) => l.id));

  return courses.map((course) => {
    const flat = (course.course_modules ?? [])
      .flatMap((m) => m.lessons ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    const next = flat.find((l) => !completed.has(l.id));

    return {
      slug: course.slug,
      title: course.title,
      completed: flat.filter((l) => completed.has(l.id)).length,
      total: flat.length,
      resume: next ? { slug: next.slug, title: next.title } : null,
      done: flat.length > 0 && !next,
    };
  });
}
