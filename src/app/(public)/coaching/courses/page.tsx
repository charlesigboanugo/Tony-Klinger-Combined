import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { listCourses } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "Self-paced filmmaking courses from Tony Klinger, delivered in the Academy.",
};

export default async function CoursesPage() {
  const courses = await listCourses();

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Courses"
          description="Buy once, learn at your own pace. Each course is delivered in the Academy and stays available for as long as your access lasts."
        />

        {courses.length === 0 ? (
          <EmptyState title="No courses published yet" />
        ) : (
          <OfferGrid count={courses.length}>
            {courses.map((course, i) => (
              <Reveal as="li" key={course.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/courses/${course.slug}`}
                  title={course.title}
                  description={course.description}
                  // The level is the label; the title says what it teaches.
                  eyebrow={course.level ?? "Course"}
                  cta="View course"
                  // Neither course is a prerequisite: the lead one says so,
                  // so "Level Two" does not read as "not for me yet".
                  meta={i === 0 && courses.length > 1 ? "No need to take Level One first" : null}
                  prices={course.prices}
                  storagePath={course.storagePath}
                  seed={course.slug}
                  priority={i < 3}
                  feature={courses.length === 1}
                />
              </Reveal>
            ))}
          </OfferGrid>
        )}
      </Container>
    </Section>
  );
}
