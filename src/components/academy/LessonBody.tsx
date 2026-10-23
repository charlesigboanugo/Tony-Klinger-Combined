import { LessonBlocks } from "@/components/academy/LessonBlocks";
import { LessonVideo } from "@/components/academy/LessonVideo";
import { parseLesson } from "@/lib/academy/lesson-markdown";
import { embedUrl, lessonVideo } from "@/lib/academy/video";

/**
 * A lesson's written material — note 07 §34.
 *
 * Set for study rather than for an essay: the blog's `Prose` opens on a drop
 * cap and closes on an end mark, which suits a piece read once, top to bottom.
 * A lesson is scanned, returned to and read in parts, so the headings do the
 * work instead — each section starts on a short red rule, and numbered points
 * hang their numerals in the margin so the list stays a list at a glance.
 *
 * A video placed inside the text (the old CMS's `:Youtube{…}` directive) is
 * built into a player HERE, on the server, by the same module as the main
 * player — so a malformed id degrades to nothing rather than a dead frame,
 * and the address only exists in a page whose lesson row RLS already
 * released (note 07 §34.1). This component must stay a server component.
 *
 * Headings are `h2`/`h3` under the lesson's own `h1`, set at the reading
 * column's scale rather than the public `--text-h2`: a section heading inside
 * a lesson is a signpost, not a poster (the same call `AccountSection` makes).
 */
export function LessonBody({ source, className }: { source: string; className?: string }) {
  return (
    <LessonBlocks
      blocks={parseLesson(source)}
      className={className}
      renderVideo={(block) => {
        const video = lessonVideo({ video_provider: block.provider, video_id: block.id, video_hash: null });
        return video ? <LessonVideo url={embedUrl(video)} title="Lesson video" /> : null;
      }}
    />
  );
}
