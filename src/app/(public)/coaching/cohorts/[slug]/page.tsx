import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OwnedState } from "@/components/coaching/OwnedState";
import {
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
  PurchasePanel,
} from "@/components/coaching/ProductPage";
import { entitlementFor } from "@/lib/commerce/entitlements";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCohort } from "@/lib/content/coaching";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/cohorts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  return cohort ? { title: cohort.name } : { title: "Not found" };
}

/**
 * Cohort detail — note 07 §37.1, the shared product page (ProductPage.tsx).
 *
 * The listing card states level, price and start date. This page must say
 * more, not less: what the eight workshops actually deliver, which is the
 * outcome copy recovered from the predecessor platform's own pricing page.
 * Always labelled a COHORT level, never a bare "Gold" — a cohort level is not
 * a membership tier (note 07 §16.1).
 */
export default async function CohortPage({
  params,
}: PageProps<"/coaching/cohorts/[slug]">) {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) notFound();

  const entitlement = await entitlementFor("cohort", cohort.id);
  const owned = entitlement.state === "active";

  const cheapest = cohort.prices.length
    ? cohort.prices.reduce((a, b) => (a.amount <= b.amount ? a : b))
    : null;
  const shown = cheapest ? formatPrice(cheapest.amount, cheapest.currency) : null;
  const level = cohort.cohort_level.charAt(0).toUpperCase() + cohort.cohort_level.slice(1);
  const starts = cohort.starts_at
    ? new Date(cohort.starts_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "To be announced";
  const buyHref = `/checkout?cohort=${cohort.slug}`;
  // The format line ("Eight x 3 hour live Zoom workshops") is already in the
  // facts row; the section reads from the outcome onwards.
  const outcomes = cohort.benefits.filter((b) => !/^eight\s*x/i.test(b.trim()));

  return (
    <>
      <ProductHero
        backHref="/coaching/cohorts"
        backLabel="All cohorts"
        eyebrow={`${level} cohort`}
        title={cohort.name}
        description={cohort.description}
        cover={{ path: cohort.storagePath }}
        price={shown}
        priceNote={shown ? "one payment" : null}
      />

      <ProductLayout
        aside={
          <PurchasePanel
            price={owned ? null : shown}
            priceNote={owned ? null : "one payment"}
            footnote={
              <>
                Ultimate Membership includes cohort access.{" "}
                <Link href="/coaching/memberships/ultimate" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  See Ultimate
                </Link>
              </>
            }
          >
            <OwnedState
              plain
              entitlement={entitlement}
              buyHref={buyHref}
              buyLabel={`Join the ${level} cohort`}
              deliveryHref="/academy/cohorts"
            />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Starts: {starts}
              {cohort.capacity ? ` · ${cohort.capacity} places` : ""}
            </p>
          </PurchasePanel>
        }
      >
        <ProductFacts
          facts={[
            { label: "Workshops", value: "Eight, three hours each" },
            { label: "Format", value: "Live on Zoom" },
            { label: "Group", value: cohort.capacity ? `${cohort.capacity} people` : "The same group throughout" },
            { label: "Starts", value: starts },
          ]}
        />

        {outcomes.length > 0 ? (
          <ProductSection title="What this level delivers">
            {/* Outcome copy: paragraphs, set for reading. */}
            <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-pretty">
              {outcomes.map((b, i) => (
                <p key={b} className={i === 0 ? "text-xl leading-snug font-medium" : "text-muted-foreground"}>
                  {b}
                </p>
              ))}
            </div>
          </ProductSection>
        ) : null}
      </ProductLayout>

      {!owned ? <MobileBuyBar price={shown} priceNote="one payment" href={buyHref} label="Join cohort" /> : null}
    </>
  );
}
