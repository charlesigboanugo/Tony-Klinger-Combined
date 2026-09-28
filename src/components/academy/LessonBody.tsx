import { Fragment } from "react";

import { LessonVideo } from "@/components/academy/LessonVideo";
import { embedUrl, lessonVideo } from "@/lib/academy/video";
import { parseLesson, type Inline, type LessonBlock } from "@/lib/academy/lesson-markdown";
import { cn } from "@/lib/utils/cn";

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
  const blocks = parseLesson(source);
  return (
    <div className={cn("space-y-5 text-[1.0625rem] leading-[1.8] text-foreground/85", className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: LessonBlock }) {
  switch (block.kind) {
    case "heading":
      return block.level === 2 ? (
        <h2 className="flex items-baseline gap-3 pt-8 font-display text-2xl leading-snug text-foreground first:pt-0 sm:text-[1.75rem]">
          <span aria-hidden="true" className="h-px w-8 shrink-0 translate-y-[-0.35em] bg-primary" />
          <span>
            <Inlines nodes={block.text} />
          </span>
        </h2>
      ) : (
        <h3 className="flex items-baseline gap-3 pt-6 font-display text-xl leading-snug text-foreground first:pt-0">
          <span aria-hidden="true" className="h-px w-5 shrink-0 translate-y-[-0.35em] bg-primary" />
          <span>
            <Inlines nodes={block.text} />
          </span>
        </h3>
      );

    case "list":
      return block.ordered ? (
        <ol start={block.start} className="space-y-3" style={{ counterReset: `item ${block.start - 1}` }}>
          {block.items.map((item, i) => (
            <li
              key={i}
              className="relative pl-10 text-pretty [counter-increment:item] before:absolute before:top-[0.2em] before:left-0 before:grid before:h-6 before:w-6 before:place-items-center before:rounded-full before:bg-surface-muted before:text-xs before:font-semibold before:text-primary before:tabular-nums before:content-[counter(item)]"
            >
              <Inlines nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="relative pl-6 text-pretty before:absolute before:top-[0.8em] before:left-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary">
              <Inlines nodes={item} />
            </li>
          ))}
        </ul>
      );

    case "video": {
      const video = lessonVideo({ video_provider: block.provider, video_id: block.id, video_hash: null });
      return video ? <LessonVideo url={embedUrl(video)} title="Lesson video" /> : null;
    }

    case "quote":
      return (
        <blockquote className="border-l-2 border-primary pl-5 text-foreground italic">
          <Inlines nodes={block.text} />
        </blockquote>
      );

    default:
      return (
        <p className="text-pretty">
          <Inlines nodes={block.text} />
        </p>
      );
  }
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.kind) {
          case "strong":
            return (
              <strong key={i} className="font-semibold text-foreground">
                <Inlines nodes={node.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={node.children} />
              </em>
            );
          case "link": {
            const external = /^https?:/.test(node.href);
            return (
              <a
                key={i}
                href={node.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
                className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
              >
                <Inlines nodes={node.children} />
              </a>
            );
          }
          default:
            return <Fragment key={i}>{node.text}</Fragment>;
        }
      })}
    </>
  );
}
