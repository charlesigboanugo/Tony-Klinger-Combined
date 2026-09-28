import type { Metadata } from "next";

import { AccountHeader } from "@/components/account/AccountHeader";
import { CourseCard } from "@/components/academy/CourseCard";
import { Reveal } from "@/components/motion/Reveal";
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
 * "Review" action per card, exactly as note 07 §34.2 established.
 *
 * Ordered by what needs attention: courses under way first, then those not
 * yet started, finished ones last.
 */
export default async function AcademyCoursesPage() {
  await requireUser("/academy/courses");
  const [courses, progress] = await Promise.all([myCourses(), progressAcrossCourses()]);
  const progressBySlug = new Map(progress.map((p) => [p.slug, p]));

  const rank = (slug: string) => {
    const p = progressBySlug.get(slug);
    if (!p) return 1;
    if (p.done) return 2;
    return p.completed > 0 ? 0 : 1;
  };
  const ordered = [...courses].sort((a, b) => rank(a.slug) - rank(b.slug));

  return (
    <>
      <AccountHeader title="Your courses" description="Pick up where you left off, or start something new." />
      {courses.length === 0 ? (
        <EmptyState icon="play"
          title="No courses yet"
          description="Courses you buy — or that come with your membership — appear here."
          action={<ButtonLink href="/coaching/courses">Browse courses</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((course, index) => (
            <Reveal as="li" key={course.id} delay={index * 60}>
              <CourseCard course={course} progress={progressBySlug.get(course.slug) ?? null} />
            </Reveal>
          ))}
        </ul>
      )}
    </>
  );
}
