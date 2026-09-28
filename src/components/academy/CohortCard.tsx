import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import {
  Card,
  CardBody,
  CardEyebrow,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
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
      <CardBody>
        <CardEyebrow className="capitalize">{cohort.cohortLevel} cohort</CardEyebrow>
        <CardTitle className="mt-1.5 text-lg">
          <CardLink href={`/academy/cohorts/${cohort.slug}`}>{cohort.name}</CardLink>
        </CardTitle>
        {cohort.description ? (
          <CardText className="mt-2 line-clamp-2">{cohort.description}</CardText>
        ) : null}
        <div className="mt-4 flex flex-1 items-end justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {cohort.startsAt ? `Starts ${formatShortDate(cohort.startsAt)}` : "Dates to be announced"}
          </p>
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
