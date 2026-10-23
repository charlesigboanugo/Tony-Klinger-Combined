import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { Card, CardBody, CardLink, CardMedia, CardTitle } from "@/components/ui/Card";
import type { EnrolledCohort } from "@/lib/academy";
import { formatShortDate } from "@/lib/account/format";

/**
 * One cohort the customer holds a place in — note 07 §35.
 *
 * Shared by the dashboard and `/academy/cohorts`, as `CourseCard` is, so the
 * two cannot drift. It opens the cohort's ACADEMY page — schedule, joining
 * links, recordings — not the public sales page it used to link out to.
 */
export function CohortCard({ cohort }: { cohort: EnrolledCohort }) {
  return (
    <Card interactive className="h-full">
      <CardMedia ratio="16/9">
        {cohort.storagePath ? (
          <StoredImage
            path={cohort.storagePath}
            alt={cohort.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <GeneratedCover title={cohort.name} seed={cohort.slug} showTitle={false} />
        )}
      </CardMedia>
      {/* THE TITLE AND THE DATES, as a course card is its title and its
          progress (owner, 2026-10-09: "not congested… just show titles only,
          like courses, and dates"). The level line and the description are on
          the cohort's own page; here they only crowded the card. */}
      <CardBody>
        <CardTitle className="text-lg">
          <CardLink href={`/academy/cohorts/${cohort.slug}`}>{cohort.name}</CardLink>
        </CardTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          {cohort.intakeLabel ? <span className="block">{cohort.intakeLabel}</span> : null}
          <span className="block">
            {cohort.inProgress && cohort.endsAt
              ? `In progress · until ${formatShortDate(cohort.endsAt)}`
              : cohort.startsAt
                ? `Starts ${formatShortDate(cohort.startsAt)}`
                : "Dates to be announced"}
          </span>
        </p>
        <div className="mt-4 flex flex-1 items-end justify-end">
          <span
            aria-hidden="true"
            className="text-sm font-medium text-accent transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
          >
            Open &rarr;
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
