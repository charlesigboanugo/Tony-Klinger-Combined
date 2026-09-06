import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import {
  Card,
  CardBody,
  CardLink,
  CardMedia,
  CardTitle,
} from "@/components/ui/Card";
import { CircularProgress } from "@/components/ui/CircularProgress";

/**
 * One enrolled course, with real progress — note 07 §32.
 *
 * Shared between the Academy dashboard and `/academy/courses` so the two
 * cannot drift into looking like different products, the same reasoning
 * `OfferCard` already applies to the five coaching listings (note 10 §27).
 *
 * The card always opens the COURSE — its curriculum, note 04 §32.3 — never a
 * lesson directly. Jumping straight to "resume" from the card was tried and
 * reversed: it meant the card sometimes went to the curriculum and sometimes
 * skipped it depending on progress, which is a card whose destination you
 * cannot predict by looking at it. "Resume" is the curriculum page's own job
 * (its primary action button), not the card's.
 */
export function CourseCard({
  course,
  progress,
}: {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    expiresAt: string | null;
    storagePath: string | null;
  };
  progress: {
    completed: number;
    total: number;
    resume: { slug: string; title: string } | null;
    done: boolean;
  } | null;
}) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  const href = `/academy/courses/${course.slug}`;

  return (
    <Card interactive className="h-full">
      <CardMedia ratio="16/9">
        {course.storagePath ? (
          <StoredImage
            path={course.storagePath}
            alt={course.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <GeneratedCover title={course.title} seed={course.slug} showTitle={false} />
        )}
      </CardMedia>

      <CardBody>
        <CardTitle className="text-lg">
          <CardLink href={href}>{course.title}</CardLink>
        </CardTitle>

        {course.description && !progress ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        ) : null}

        {pct !== null ? (
          <div className="mt-3 flex items-center gap-3">
            <CircularProgress percent={pct} color="var(--accent)" />
            <p className="text-xs text-muted-foreground">
              {progress!.completed} of {progress!.total} lessons
              {progress!.done ? " — complete" : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-1 items-end justify-between gap-3 pt-1">
          {course.expiresAt ? (
            <p className="text-xs text-muted-foreground">
              Access until {new Date(course.expiresAt).toLocaleDateString("en-GB")}
            </p>
          ) : (
            <span />
          )}
          <span
            aria-hidden="true"
            className="text-sm font-medium text-accent transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
          >
            {progress?.resume ? "Resume" : progress?.done ? "Review" : "Start"} &rarr;
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
