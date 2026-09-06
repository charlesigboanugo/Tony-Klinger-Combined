import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OwnedState } from "@/components/coaching/OwnedState";
import { PriceTag } from "@/components/coaching/PriceTag";
import { Container, Section } from "@/components/layout/Container";
import { BackLink } from "@/components/ui/BackLink";
import { entitlementFor } from "@/lib/commerce/entitlements";
import { getCohort } from "@/lib/content/coaching";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/cohorts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  return cohort ? { title: cohort.name } : { title: "Not found" };
}

/**
 * Cohort detail — note 07 §37.1.
 *
 * The listing card states level, price and start date. This page must say
 * more, not less: what the eight workshops actually deliver, which is the
 * outcome copy recovered from the predecessor platform's own pricing page
 * rather than the one-line summary a card can hold.
 */
export default async function CohortPage({
  params,
}: PageProps<"/coaching/cohorts/[slug]">) {
  const { slug } = await params;
  const cohort = await getCohort(slug);
  if (!cohort) notFound();

  const entitlement = await entitlementFor("cohort", cohort.id);

  return (
    <Section>
      <Container>
        <BackLink href="/coaching/cohorts">All cohorts</BackLink>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {/* Never a bare "Gold" — a cohort level, not a membership tier
                    (note 07 §16.1). */}
                {cohort.cohort_level} cohort
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {cohort.name}
              </h1>
            </div>

            <dl className="grid gap-4 rounded-(--radius) border border-border bg-surface p-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">Workshops</dt>
                <dd className="mt-1 font-medium">8 × 3 hours</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Total time</dt>
                <dd className="mt-1 font-medium">24 hours</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Format</dt>
                <dd className="mt-1 font-medium">Live, over Zoom</dd>
              </div>
            </dl>

            {cohort.benefits.length > 0 ? (
              <section aria-labelledby="delivers">
                <h2 id="delivers" className="text-xl font-semibold tracking-tight">
                  What this level delivers
                </h2>
                <div className="mt-4 space-y-3 text-muted-foreground">
                  {cohort.benefits.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="lg:pt-2">
            <div className="rounded-(--radius) border border-border bg-surface p-6">
              <PriceTag prices={cohort.prices} />
              {cohort.starts_at ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Starts{" "}
                  {new Date(cohort.starts_at).toLocaleDateString("en-GB", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              ) : null}
              {cohort.capacity ? (
                <p className="mt-1 text-sm text-muted-foreground">{cohort.capacity} places</p>
              ) : null}

              <div className="mt-5">
                <OwnedState
                  entitlement={entitlement}
                  buyHref={`/checkout?cohort=${cohort.slug}`}
                  buyLabel={`Join ${cohort.cohort_level}`}
                  deliveryHref="/academy/cohorts"
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Ultimate Membership includes unlimited cohort access — this is
              also available as a direct purchase (note 07 §17).
            </p>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
