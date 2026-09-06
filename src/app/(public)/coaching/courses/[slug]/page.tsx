import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/coaching/AddToCart";
import { OwnedState } from "@/components/coaching/OwnedState";
import { Container, Section } from "@/components/layout/Container";
import { BackLink } from "@/components/ui/BackLink";
import { entitlementFor } from "@/lib/commerce/entitlements";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCourse, priceForProduct } from "@/lib/content/coaching";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  return course
    ? { title: course.title, description: course.description ?? undefined }
    : { title: "Not found" };
}

export default async function CoursePage({
  params,
}: PageProps<"/coaching/courses/[slug]">) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const [price, entitlement] = await Promise.all([
    priceForProduct(course.product_id),
    entitlementFor("course", course.id),
  ]);

  return (
    <Section>
      <Container>
        <BackLink href="/coaching/courses">All courses</BackLink>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {course.title}
            </h1>
            {course.description ? (
              <p className="text-lg text-muted-foreground text-pretty">
                {course.description}
              </p>
            ) : null}

            {/* The public page describes the course; it never contains the
                lessons themselves (note 07 §37). */}
            <div className="rounded-(--radius) border border-border bg-surface p-6">
              <h2 className="font-medium">What you get</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Lifetime access to the course in the Academy</li>
                <li>Modules, lessons and downloadable resources</li>
                <li>Progress tracking across devices</li>
              </ul>
            </div>
          </div>

          <aside className="lg:pt-2">
            {/*
              The PRODUCT slug, not the course slug. `level-one` is the course;
              `course-level-one` is the product the order pipeline resolves —
              linking with the course slug reached a checkout that could find
              nothing to sell.
            */}
            <OwnedState
              entitlement={entitlement}
              buyHref={
                course.productSlug
                  ? `/checkout?course=${course.productSlug}`
                  : undefined
              }
              buyLabel="Buy this course"
              deliveryHref={`/academy/courses/${course.slug}`}
              priceLabel={price ? formatPrice(price.amount, price.currency) : undefined}
            />

            {/* A basket is a different intent from buying one thing now, so
                both are offered rather than forcing everyone through the cart. */}
            {entitlement.state !== "active" && course.productSlug ? (
              <AddToCart slug={course.productSlug} className="mt-4" />
            ) : null}
          </aside>
        </div>
      </Container>
    </Section>
  );
}
