import { ComingSoon } from "@/components/content/WorkCard";
import { StoredImage } from "@/components/media/StoredImage";
import { VideoFacade } from "@/components/media/VideoFacade";
import { Reveal } from "@/components/motion/Reveal";
import type { TestimonialVideo } from "@/lib/content/testimonial-videos";
import { cn } from "@/lib/utils/cn";

/** 67 → "1:07". */
function runningTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Filmed testimonials, as a wall of portrait frames — migration 0015.
 *
 * Portrait because most of these were filmed on a phone held upright, and a
 * landscape frame would crop a standing speaker to her coat. The crop sits
 * high so a face stays in frame whichever way the clip was shot.
 *
 * A clip with a video plays in place when pressed (`VideoFacade`). One still
 * waiting for its upload shows its cover and "Coming soon", and is not a
 * button — a control that does nothing reads as broken.
 */
export function TestimonialVideos({ videos }: { videos: TestimonialVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {videos.map((v, i) => (
        <li key={v.id}>
          <Reveal delay={(i % 4) * 60}>
            <TestimonialVideoCard video={v} />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

/** One filmed testimonial: its frame, and who said it. For grids and carousels alike. */
export function TestimonialVideoCard({
  video: v,
  plainCaption = true,
}: {
  video: TestimonialVideo;
  /**
   * Caption in the body face rather than the display serif — the coaching
   * section's type rule (owner, 2026-09-26: the serif only for headings and
   * prices, where it is large and heavy).
   */
  plainCaption?: boolean;
}) {
  // Only the compilation has no one name; its title is its title card, not a quote.
  const who = v.attributed_to ?? "Compilation";
  const label = v.title ? `${v.title} — ${who}` : `${who}'s testimonial`;
  const frame = "aspect-4/5 w-full overflow-hidden rounded-sm";
  const cover = (
    <span className={cn("relative block bg-black", frame)}>
      <StoredImage
        path={v.cover_path}
        alt=""
        fill
        sizes="(min-width: 1024px) 18rem, (min-width: 768px) 30vw, 45vw"
        className="object-[50%_22%] opacity-90"
      />
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
      {v.duration_seconds ? (
        <span className="absolute right-3 bottom-3 text-xs font-medium tabular-nums text-white/85">
          {runningTime(v.duration_seconds)}
        </span>
      ) : null}
    </span>
  );

  return (
    <figure>
      {v.embed_url ? (
        <VideoFacade src={v.embed_url} title={label} className={frame}>
          {cover}
        </VideoFacade>
      ) : (
        <div className="relative">
          {cover}
          <ComingSoon tone="dark" className="absolute top-3 left-3" />
        </div>
      )}
      <figcaption className="mt-4">
        {v.title ? (
          <p className={cn("text-lg leading-snug text-pretty", plainCaption ? "font-medium" : "font-display")}>
            {v.attributed_to ? (
              <span aria-hidden="true" className="mr-0.5 text-primary">&ldquo;</span>
            ) : null}
            {v.title}
          </p>
        ) : null}
        <p className={cn("text-sm", v.title ? "mt-1 text-block-foreground/70" : cn("text-lg", plainCaption ? "font-medium" : "font-display"))}>
          {who}
        </p>
      </figcaption>
    </figure>
  );
}
