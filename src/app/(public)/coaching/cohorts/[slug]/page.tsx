import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CohortPurchase } from "@/app/(public)/coaching/cohorts/[slug]/CohortPurchase";
import { MobileBuyBar, ProductFacts, ProductHero, ProductLayout, ProductSection, PurchasePanel } from "@/components/coaching/ProductPage";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { phaseStatus } from "@/lib/content/offer-status";
import { formatPrice } from "@/lib/commerce/pricing";
import type { SaleStatus } from "@/lib/commerce/sale-status";
import { getCohort, listIntakes } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/cohorts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  return cohort
    ? pageMetadata({
        title: cohort.name,
        description: cohort.description,
        path: `/coaching/cohorts/${cohort.slug}`,
        image: { storagePath: cohort.storagePath, alt: cohort.name },
      })
    : { title: "Not found" };
}

/**
 * Cohort detail — note 07 §16.2, §37.1; the shared product page.
 *
 * THE COHORT IS FIXED, ITS INTAKES COME AND GO (owner, 2026-10-09; migration
 * 0017). This page is the cohort — what the level delivers and what it costs —
 * and stays up all year. Each running of it is an INTAKE with its own dates,
 * places and registration period, listed here; whether the cohort can be
 * joined is decided by them:
 *
 *   an intake open for registration   the price buys a place on it
 *   an intake coming                  "Registration opens …"
 *   an intake under way               "In progress", closed
 *   none                              "Dates to be announced"
 *
 * Always labelled a COHORT level, never a bare "Gold" — a cohort level is not
 * a membership tier (note 07 §16.1).
 */
export default async function CohortPage({ params }: PageProps<"/coaching/cohorts/[slug]">) {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) notFound();

  const intakes = await listIntakes([cohort.id]);

  const cheapest = cohort.prices.length ? cohort.prices.reduce((a, b) => (a.amount <= b.amount ? a : b)) : null;
  const shown = cheapest ? formatPrice(cheapest.amount, cheapest.currency) : null;
  const level = cohort.cohort_level.charAt(0).toUpperCase() + cohort.cohort_level.slice(1);

  const day = (value: string) =>
    new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

  // What the public facts say. The purchase component refines it for the
  // visitor after load, and checkout asks the database before taking anything.
  const open = intakes.find((i) => i.state === "open");
  const upcoming = intakes.find((i) => i.state === "upcoming");
  const initial: SaleStatus = !cohort.productSlug
    ? "unavailable"
    : open
      ? "ok"
      : intakes.some((i) => i.state === "full")
        ? "full"
        : upcoming
          ? "closed"
          : intakes.some((i) => i.state === "in_progress")
            ? "past"
            : "unscheduled";

  const lead = open ?? upcoming ?? intakes[0] ?? null;
  // The format line ("Eight x 3 hour live Zoom workshops") is already in the
  // facts row; the section reads from the outcome onwards.
  const outcomes = cohort.benefits.filter((b) => !/^eight\s*x/i.test(b.trim()));

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: "Coaching", path: "/coaching" },
          { name: "Cohorts", path: "/coaching/cohorts" },
          { name: cohort.name, path: `/coaching/cohorts/${cohort.slug}` },
        ]}
      />
      <ProductHero
        backHref="/coaching/cohorts"
        backLabel="All cohorts"
        eyebrow={`${level} cohort`}
        title={cohort.name}
        description={cohort.description}
        cover={{ path: cohort.storagePath }}
        price={shown}
        priceNote={shown ? "one payment" : null}
        status={phaseStatus(intakes)}
      />

      <ProductLayout
        aside={
          <PurchasePanel
            price={shown}
            priceNote="one payment"
            footnote={
              <>
                One payment for a place on one intake: all eight workshops, and their recordings afterwards. Cohorts
                are separate from{" "}
                <Link href="/coaching/passes" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  membership
                </Link>
                .
              </>
            }
          >
            <CohortPurchase
              productSlug={cohort.productSlug}
              level={level}
              initial={initial}
              opensOn={upcoming ? day(upcoming.registrationOpensAt) : null}
            />
          </PurchasePanel>
        }
      >
        <ProductFacts
          facts={[
            { label: "Workshops", value: "Eight, three hours each" },
            { label: "Format", value: "Live on Zoom" },
            { label: "Group", value: "The same group throughout" },
            { label: "Next intake", value: lead ? day(lead.startsAt) : "To be announced" },
          ]}
        />

        {/* The intakes: when the cohort runs, and whether it can be joined. */}
        {intakes.length > 0 ? (
          <ProductSection title="Intakes">
            <ul className="max-w-2xl divide-y divide-border border-y border-border">
              {intakes.map((intake) => (
                <li key={intake.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <div>
                    <p className="font-semibold">{intake.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {day(intake.startsAt)} to {day(intake.endsAt)}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm font-medium", intake.state === "open" ? "text-accent" : "text-muted-foreground")}>
                    {intake.state === "open"
                      ? intake.placesLeft == null
                        ? "Registration open"
                        : `Registration open · ${intake.placesLeft} place${intake.placesLeft === 1 ? "" : "s"} left`
                      : intake.state === "full"
                        ? "Fully booked"
                        : intake.state === "in_progress"
                          ? "In progress · closed to new people"
                          : `Registration opens ${day(intake.registrationOpensAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          </ProductSection>
        ) : null}

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

      <MobileBuyBar price={shown} priceNote="one payment" href="#buy" label={open ? "Join cohort" : "See intakes"} />
    </>
  );
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
