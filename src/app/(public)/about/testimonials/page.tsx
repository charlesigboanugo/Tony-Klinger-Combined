import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Testimonials } from "@/components/content/Testimonials";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listTestimonials } from "@/lib/content/testimonials";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "What people who have worked with Tony Klinger say about the coaching, the courses and the results.",
};

/**
 * Testimonials — note 03 §5.
 *
 * THE FULL SET, and the only place that shows it. The home page and the
 * coaching storefront each render a short selection through the same
 * `Testimonials` component; this page is where "see all" leads. One data
 * source, one component, three placements — no second copy of the quotes
 * (note 03 §37).
 *
 * NO `context` FILTER. The selections elsewhere are narrowed to where they
 * belong; this page deliberately is not, because a visitor who has come
 * looking for proof should see all of it rather than a slice chosen for a
 * different page's purpose.
 */
export default async function TestimonialsPage() {
  const testimonials = await listTestimonials();

  return (
    <Section>
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link
            href="/about"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            About
          </Link>
          <span className="mx-2 text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="text-foreground">Testimonials</span>
        </nav>

        <PageHeader
          title="Testimonials"
          description="What people who have worked with Tony say about it, in their own words."
          actions={
            <ButtonLink href="/coaching" variant="outline" size="sm">
              See the coaching
            </ButtonLink>
          }
        />

        {testimonials.length > 0 ? (
          <Testimonials testimonials={testimonials} heading="In their words" />
        ) : (
          <EmptyState
            title="No testimonials published yet"
            description="They will appear here as they are published."
            action={
              <ButtonLink href="/coaching" variant="outline">
                See the coaching
              </ButtonLink>
            }
          />
        )}
      </Container>
    </Section>
  );
}
