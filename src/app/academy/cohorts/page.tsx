import type { Metadata } from "next";

import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardBody,
  CardEyebrow,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myCohorts } from "@/lib/academy";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Cohorts", robots: { index: false } };

/**
 * Requires a session; content is entitlement-gated by RLS. Real data, not a
 * permanent placeholder — `myCohorts()` resolves the customer's own cohort
 * entitlements the same way `myCourses()` does (note 07 §32).
 *
 * Full curriculum and benefits already live on the cohort's public page
 * (`/coaching/cohorts/[slug]`), so "more info" links out there rather than
 * duplicating it — note 07 §37.1's rule cuts both ways: a page must not say
 * less than its card, but it must not repeat what another page already owns.
 */
export default async function Page() {
  await requireUser("/academy/cohorts");
  const cohorts = await myCohorts();

  return (
    <>
      <PageHeader title="Cohorts" description="Your cohort workshops, schedules and recordings." />

      {cohorts.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="This fills in as soon as you have a place in a cohort."
          action={<ButtonLink href="/coaching/cohorts">Explore cohorts</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((cohort) => (
            <li key={cohort.id}>
              <Card interactive className="h-full">
                <CardMedia ratio="16/9">
                  {cohort.storagePath ? (
                    <StoredImage
                      path={cohort.storagePath}
                      alt={cohort.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  ) : (
                    <GeneratedCover title={cohort.name} seed={cohort.slug} showTitle={false} />
                  )}
                </CardMedia>
                <CardBody>
                  <CardEyebrow className="capitalize">{cohort.cohortLevel} level</CardEyebrow>
                  <CardTitle className="mt-1.5 text-lg">
                    <CardLink href={`/coaching/cohorts/${cohort.slug}`}>{cohort.name}</CardLink>
                  </CardTitle>
                  {cohort.description ? (
                    <CardText className="mt-2 line-clamp-2">{cohort.description}</CardText>
                  ) : null}
                  <p className="mt-4 text-xs text-muted-foreground">
                    {cohort.startsAt
                      ? `Starts ${new Date(cohort.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : "Schedule to be announced"}
                  </p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
