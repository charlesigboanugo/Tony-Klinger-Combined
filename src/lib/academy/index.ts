import "server-only";

import { embedUrl, lessonVideo } from "@/lib/academy/video";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/permissions";

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
  // Filtered to the caller as well as by RLS: staff can read every
  // entitlement, and their Academy must show their own (see lib/account).
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();

  const { data: grants } = await supabase
    .from("entitlements")
    .select("expires_at,resource_id")
    .eq("user_id", userId)
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
  /** The level code ("silver", or one staff added). */
  cohortLevel: string;
  /**
   * The start of the intake they are on. With standing access (no intake of
   * their own) it is the cohort's intake under way, or else the next one —
   * the one whose workshops their cohort page lists. Null only where the
   * cohort has no intake still to finish.
   */
  startsAt: string | null;
  /** That intake's end. */
  endsAt: string | null;
  /** It has begun and not yet ended. Read from the clock here, not in render. */
  inProgress: boolean;
  /** Their intake's name: "Spring 2027". */
  intakeLabel: string | null;
  storagePath: string | null;
};

/**
 * Cohorts this customer is in — migration 0017.
 *
 * Being IN a cohort is being on one of its intakes (`cohort_enrolments`), or,
 * for a few, holding standing access to it (granted by staff, or bought before
 * intakes). A place paid for and not yet put on an intake is not listed here:
 * `myIntakeChoices` is where that is finished.
 */
export async function myCohorts(): Promise<EnrolledCohort[]> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();

  const [{ data: enrolments }, { data: grants }] = await Promise.all([
    supabase
      .from("cohort_enrolments")
      .select("cohort_intakes(cohort_id,label,starts_at,ends_at)")
      .eq("user_id", userId),
    supabase
      .from("entitlements")
      .select("resource_id")
      .eq("user_id", userId)
      .eq("resource_type", "cohort")
      .eq("status", "active")
      .is("quantity", null),
  ]);

  // The latest intake of each cohort is the one that matters to show.
  const intakeByCohort = new Map<string, { label: string; starts_at: string; ends_at: string }>();
  for (const row of (enrolments ?? []) as unknown as Array<{
    cohort_intakes: { cohort_id: string; label: string; starts_at: string; ends_at: string } | null;
  }>) {
    const intake = row.cohort_intakes;
    if (!intake) continue;
    const seen = intakeByCohort.get(intake.cohort_id);
    if (!seen || intake.starts_at > seen.starts_at) intakeByCohort.set(intake.cohort_id, intake);
  }

  const ids = [
    ...new Set([
      ...intakeByCohort.keys(),
      ...((grants ?? []) as Array<{ resource_id: string | null }>)
        .map((r) => r.resource_id)
        .filter((id): id is string => id !== null),
    ]),
  ];
  if (ids.length === 0) return [];

  /*
    STANDING ACCESS HAS NO INTAKE OF ITS OWN, but the cohort's page lists the
    workshops of the intake that is running. The card said "Dates to be
    announced" over a page full of dates (owner, 2026-10-09). So where there
    is no enrolment, the card takes the cohort's intake under way, or else the
    next to start.
  */
  const now = Date.now();
  const standing = ids.filter((id) => !intakeByCohort.has(id));
  if (standing.length > 0) {
    const { data: open } = await supabase
      .from("cohort_intakes")
      .select("cohort_id,label,starts_at,ends_at")
      .in("cohort_id", standing)
      .eq("status", "published")
      .gt("ends_at", new Date(now).toISOString())
      .order("starts_at");
    for (const intake of (open ?? []) as Array<{ cohort_id: string; label: string; starts_at: string; ends_at: string }>) {
      // Soonest first, so the first seen for a cohort is the one running or next.
      if (!intakeByCohort.has(intake.cohort_id)) intakeByCohort.set(intake.cohort_id, intake);
    }
  }

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id,name,slug,description,cohort_level,resources!cover_resource_id(storage_path)")
    .in("id", ids);

  return ((cohorts ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cohort_level: string;
    resources: { storage_path: string } | null;
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    cohortLevel: c.cohort_level,
    startsAt: intakeByCohort.get(c.id)?.starts_at ?? null,
    endsAt: intakeByCohort.get(c.id)?.ends_at ?? null,
    inProgress: (() => {
      const intake = intakeByCohort.get(c.id);
      return Boolean(intake && +new Date(intake.starts_at) <= now && +new Date(intake.ends_at) > now);
    })(),
    intakeLabel: intakeByCohort.get(c.id)?.label ?? null,
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
  storagePath: string | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    position: number;
    lessons: Array<{
      id: string;
      title: string;
      slug: string;
      position: number;
      /** Whether there is video at all — never the address of it. */
      hasVideo: boolean;
      /** Running time, for the outline. A length reveals nothing a URL would. */
      durationSeconds: number | null;
    }>;
  }>;
};

/**
 * Course order: by position, and where two share one, in the order they were
 * created (owner, 2026-10-15). Without the second key, tied lessons came back
 * in whatever order the database returned them, which could change.
 */
const byPlace = (a: { position: number; created_at: string }, b: { position: number; created_at: string }) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

/**
 * A course with its structure.
 *
 * Modules and lessons come back only when the caller holds a live entitlement —
 * enforced by RLS (migration 0002_security_and_reference_data), not by a check here. Without entitlement
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
      "id,title,slug,description,resources!cover_resource_id(storage_path),course_modules(id,title,description,position,created_at,lessons(id,title,slug,position,created_at,video_provider,video_id,video_duration_seconds))",
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
    resources: { storage_path: string } | null;
    course_modules: Array<{
      id: string;
      title: string;
      description: string | null;
      position: number;
      created_at: string;
      lessons: Array<{
        id: string;
        title: string;
        slug: string;
        position: number;
        created_at: string;
        video_provider: string | null;
        video_id: string | null;
        video_duration_seconds: number | null;
      }>;
    }>;
  };

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    storagePath: course.resources?.storage_path ?? null,
    modules: (course.course_modules ?? [])
      .slice()
      .sort(byPlace)
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        position: m.position,
        lessons: (m.lessons ?? [])
          .slice()
          .sort(byPlace)
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
            durationSeconds: l.video_duration_seconds,
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
      "id,title,slug,description,content,video_provider,video_id,video_hash,video_duration_seconds",
    )
    .eq("id", flat[index].id)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    content: string | null;
    video_provider: string | null;
    video_id: string | null;
    video_hash: string | null;
    video_duration_seconds: number | null;
  };

  /*
    The URL is composed HERE, on the far side of the RLS check that returned
    this row (migration 0002_security_and_reference_data: a lesson is only readable with a live entitlement
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
      description: row.description,
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

/**
 * Group Coaching sessions the customer has paid for and not yet used.
 *
 * Sessions are FOR A SERIES (migration 0014): `bySeries` says how many of
 * which, soonest to lapse first, so a page can say "8 Writing sessions" rather
 * than a bare count that hides where they may be spent. `series` is null for
 * sessions good for any series (granted by staff, or bought before that rule).
 * Lapsed ones are left out even where the nightly job has not yet marked them.
 */
export async function sessionCredits(): Promise<{
  remaining: number;
  bySeries: Array<{ series: string | null; remaining: number; expiresAt: string | null }>;
} | null> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("entitlements")
    .select("resource_id,quantity,quantity_used,expires_at")
    .eq("user_id", userId)
    .eq("resource_type", "group_coaching_session")
    .eq("status", "active")
    .not("quantity", "is", null);

  const now = Date.now();
  const rows = ((data ?? []) as Array<{
    resource_id: string | null;
    quantity: number;
    quantity_used: number;
    expires_at: string | null;
  }>).filter((r) => !r.expires_at || +new Date(r.expires_at) > now);
  if (rows.length === 0) return null;

  const ids = [...new Set(rows.map((r) => r.resource_id).filter((id): id is string => id !== null))];
  const { data: series } = ids.length
    ? await supabase.from("group_coaching_series").select("id,name").in("id", ids)
    : { data: [] };
  const nameOf = new Map((series ?? []).map((row) => [row.id, row.name]));

  const grouped = new Map<string, { series: string | null; remaining: number; expiresAt: string | null }>();
  for (const r of rows) {
    const left = r.quantity - (r.quantity_used ?? 0);
    if (left <= 0) continue;
    const key = r.resource_id ?? "any";
    const entry = grouped.get(key) ?? {
      series: r.resource_id ? (nameOf.get(r.resource_id) ?? "Group Coaching") : null,
      remaining: 0,
      expiresAt: null,
    };
    entry.remaining += left;
    if (r.expires_at && (!entry.expiresAt || r.expires_at < entry.expiresAt)) entry.expiresAt = r.expires_at;
    grouped.set(key, entry);
  }

  const bySeries = [...grouped.values()].sort((a, b) => (a.expiresAt ?? "9").localeCompare(b.expiresAt ?? "9"));
  return { remaining: bySeries.reduce((sum, e) => sum + e.remaining, 0), bySeries };
}

/**
 * Which lessons of a course this person has finished — note 07 §32.
 *
 * A set of lesson ids rather than a count, because the course outline needs to
 * tick individual rows and the summary is derivable from the set. RLS restricts
 * `lesson_progress` to the caller's own rows (migration 0007_staff_accounts_and_lesson_video), so this cannot
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
  // this is already the enrolled set (migration 0002_security_and_reference_data).
  const { data } = await supabase
    .from("courses")
    .select("id,title,slug,course_modules(id,position,created_at,lessons(id,title,slug,position,created_at))")
    .eq("status", "published");

  type Row = {
    id: string;
    title: string;
    slug: string;
    course_modules: Array<{
      id: string;
      position: number;
      created_at: string;
      lessons: Array<{ id: string; title: string; slug: string; position: number; created_at: string }>;
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
    // Module by module, then lesson by lesson: a lesson's position counts
    // within its module, so sorting the whole course by it alone mixed them.
    const flat = (course.course_modules ?? [])
      .slice()
      .sort(byPlace)
      .flatMap((m) => (m.lessons ?? []).slice().sort(byPlace));
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
