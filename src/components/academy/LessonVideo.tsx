/**
 * The lesson player — note 07 §R29.
 *
 * A server component on purpose. The embed URL is composed on the far side of
 * the entitlement check and handed straight to an iframe, so it never passes
 * through client-side props that would put it in the page's serialised data for
 * anyone to read.
 *
 * The aspect ratio is held by the container rather than by width/height
 * attributes, so the player scales with the column on a phone instead of
 * overflowing it.
 */
export function LessonVideo({
  url,
  title,
  durationSeconds,
}: {
  url: string;
  title: string;
  durationSeconds?: number | null;
}) {
  return (
    <figure className="mt-6">
      <div className="relative aspect-video w-full overflow-hidden rounded-(--radius-lg) border border-border bg-black shadow-card">
        <iframe
          src={url}
          title={`${title} — video`}
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin"
          className="absolute inset-0 size-full"
        />
      </div>
      {durationSeconds ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {Math.round(durationSeconds / 60)} minutes
        </figcaption>
      ) : null}
    </figure>
  );
}
