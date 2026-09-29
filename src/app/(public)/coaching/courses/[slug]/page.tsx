import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/coaching/AddToCart";
import { CheckList, ProductFacts, ProductHero, ProductLayout, ProductSection } from "@/components/coaching/ProductPage";
import {
  OwnershipProvider,
  UnlessOwned,
  ViewerMobileBuyBar,
  ViewerOwnedState,
  ViewerPurchasePanel,
} from "@/components/coaching/ViewerOwnership";
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

/**
 * Course detail — note 07 §37, the shared product page (ProductPage.tsx).
 *
 * The public page describes the course; it never contains the lessons
 * themselves (note 07 §37).
 */
export default async function CoursePage({
  params,
}: PageProps<"/coaching/courses/[slug]">) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const price = await priceForProduct(course.product_id);

  const shown = price ? formatPrice(price.amount, price.currency) : null;
  /*
    The PRODUCT slug, not the course slug. `level-one` is the course;
    `course-level-one` is the product the order pipeline resolves — linking
    with the course slug reached a checkout that could find nothing to sell.
  */
  const buyHref = course.productSlug ? `/checkout?course=${course.productSlug}` : undefined;
  return (
    <OwnershipProvider resourceType="course" resourceId={course.id}>
      <ProductHero
        backHref="/coaching/courses"
        backLabel="All courses"
        eyebrow={course.level ?? "Course"}
        title={course.title}
        description={course.description}
        cover={{ path: course.storagePath }}
        price={shown}
        priceNote={shown ? "one payment" : null}
      />

      <ProductLayout
        aside={
          <ViewerPurchasePanel
            price={shown}
            priceNote="one payment"
            footnote="Pay once for lifetime access in the Academy, on any device."
          >
            <ViewerOwnedState
              plain
              buyHref={buyHref}
              buyLabel="Buy this course"
              deliveryHref={`/academy/courses/${course.slug}`}
            />
            {/* A basket is a different intent from buying one thing now, so
                both are offered rather than forcing everyone through the cart. */}
            {course.productSlug ? (
              <UnlessOwned>
                <AddToCart slug={course.productSlug} className="mt-3 [&_button]:w-full [&_form]:w-full" />
              </UnlessOwned>
            ) : null}
          </ViewerPurchasePanel>
        }
      >
        <ProductFacts
          facts={[
            { label: "Format", value: "Self-paced" },
            { label: "Where", value: "Online, in the Academy" },
            { label: "Access", value: "Lifetime" },
          ]}
        />

        <ProductSection title="What you get">
          <CheckList
            items={[
              "Every lesson of the course, in the order Tony teaches it",
              "Video lessons with written notes alongside",
              "Downloadable resources",
              "Your progress saved across devices",
            ]}
          />
        </ProductSection>
      </ProductLayout>

      {buyHref ? (
        <ViewerMobileBuyBar price={shown} priceNote="one payment" href={buyHref} label="Buy course" />
      ) : null}
    </OwnershipProvider>
  );
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
