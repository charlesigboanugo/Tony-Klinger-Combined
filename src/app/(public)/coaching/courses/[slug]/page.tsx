import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/coaching/AddToCart";
import { OwnedState } from "@/components/coaching/OwnedState";
import {
  CheckList,
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
  PurchasePanel,
} from "@/components/coaching/ProductPage";
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

  const [price, entitlement] = await Promise.all([
    priceForProduct(course.product_id),
    entitlementFor("course", course.id),
  ]);

  const shown = price ? formatPrice(price.amount, price.currency) : null;
  /*
    The PRODUCT slug, not the course slug. `level-one` is the course;
    `course-level-one` is the product the order pipeline resolves — linking
    with the course slug reached a checkout that could find nothing to sell.
  */
  const buyHref = course.productSlug ? `/checkout?course=${course.productSlug}` : undefined;
  const owned = entitlement.state === "active";

  return (
    <>
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
          <PurchasePanel
            price={owned ? null : shown}
            priceNote={owned ? null : "one payment"}
            footnote="Pay once for lifetime access in the Academy, on any device."
          >
            <OwnedState
              plain
              entitlement={entitlement}
              buyHref={buyHref}
              buyLabel="Buy this course"
              deliveryHref={`/academy/courses/${course.slug}`}
            />
            {/* A basket is a different intent from buying one thing now, so
                both are offered rather than forcing everyone through the cart. */}
            {!owned && course.productSlug ? (
              <AddToCart slug={course.productSlug} className="mt-3 [&_button]:w-full [&_form]:w-full" />
            ) : null}
          </PurchasePanel>
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

      {!owned && buyHref ? (
        <MobileBuyBar price={shown} priceNote="one payment" href={buyHref} label="Buy course" />
      ) : null}
    </>
  );
}
