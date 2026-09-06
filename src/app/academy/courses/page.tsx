import type { Metadata } from "next";

import { CourseCard } from "@/components/academy/CourseCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myCourses, progressAcrossCourses } from "@/lib/academy";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Courses", robots: { index: false } };

/**
 * Requires a session; content is entitlement-gated by RLS. Shares
 * `CourseCard` with the dashboard's "Continue learning" so this and the
 * summary on `/academy` cannot drift into two different products — real
 * cover art (or a generated fallback), real progress, one "Resume"/"Start"/
 * "Review" action per card, exactly as note 07 §32 already established.
 */
export default async function AcademyCoursesPage() {
  await requireUser("/academy/courses");
  const [courses, progress] = await Promise.all([myCourses(), progressAcrossCourses()]);
  const progressBySlug = new Map(progress.map((p) => [p.slug, p]));

  return (
    <>
      <PageHeader title="Your courses" />
      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Courses you buy — or that come with your membership — appear here."
          action={<ButtonLink href="/coaching/courses">Browse courses</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} progress={progressBySlug.get(course.slug) ?? null} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
