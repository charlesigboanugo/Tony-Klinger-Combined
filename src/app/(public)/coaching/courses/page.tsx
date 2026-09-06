import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
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
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, i) => (
              <Reveal as="li" key={course.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/courses/${course.slug}`}
                  title={course.title}
                  description={course.description}
                  eyebrow="Course"
                  prices={course.prices}
                  storagePath={course.storagePath}
                  seed={course.slug}
                  priority={i < 3}
                />
              </Reveal>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
