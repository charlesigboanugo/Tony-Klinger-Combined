import { Fragment, type ReactNode } from "react";

import type { Inline, LessonBlock } from "@/lib/academy/lesson-markdown";
import { cn } from "@/lib/utils/cn";

/** Builds the player for a video placed inside the text. */
export type VideoRenderer = (block: Extract<LessonBlock, { kind: "video" }>) => ReactNode;

/**
 * How a lesson's written material is laid out — note 07 §34. Shared by the
 * lesson page (`LessonBody`, on the server) and the admin editor's preview
 * (owner, 2026-10-15), so the preview is the page, not an imitation of it.
 *
 * The one thing it does not do is build a video: the page passes a renderer
 * that makes the real player on the server, where the address is composed;
 * the admin preview passes one that shows a placeholder. Nothing here may
 * import the server-only video module.
 */
export function LessonBlocks({
  blocks,
  renderVideo,
  className,
}: {
  blocks: LessonBlock[];
  renderVideo: VideoRenderer;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5 text-[1.0625rem] leading-[1.8] text-foreground/85", className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} renderVideo={renderVideo} />
      ))}
    </div>
  );
}

function Block({ block, renderVideo }: { block: LessonBlock; renderVideo: VideoRenderer }) {
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

    case "video":
      return renderVideo(block);

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
