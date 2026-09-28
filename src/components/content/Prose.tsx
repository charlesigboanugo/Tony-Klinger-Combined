import { Fragment } from "react";

import { linkify, parseProse, type ProseBlock } from "@/lib/content/prose";
import { cn } from "@/lib/utils/cn";

/**
 * Long-form reading column for plain-text bodies — note 10 §42.
 *
 * Set for reading, not for scanning: a 17px body on generous leading, a
 * measure held near 68 characters by the narrow container, and paragraphs
 * separated by space rather than indents. The opening paragraph carries a
 * drop cap in the display face, the oldest signal in print that a piece of
 * writing starts here; the last paragraph ends on a small square end mark,
 * so a reader knows the essay is finished and not cut off.
 *
 * Parsing lives in `lib/content/prose.ts`, which is where the archive's
 * formatting habits are explained.
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks = parseProse(text);
  const firstParagraph = blocks.findIndex((b) => b.kind === "paragraph");
  const lastParagraph = blocks.findLastIndex((b) => b.kind === "paragraph");

  return (
    <div className={cn("space-y-6 text-[1.0625rem] leading-[1.8] sm:text-lg", className)}>
      {blocks.map((block, i) => (
        <ProseBlockView
          key={i}
          block={block}
          dropCap={i === firstParagraph}
          endMark={i === lastParagraph}
        />
      ))}
    </div>
  );
}

function ProseBlockView({
  block,
  dropCap,
  endMark,
}: {
  block: ProseBlock;
  dropCap: boolean;
  endMark: boolean;
}) {
  if (block.kind === "heading") {
    return (
      <h2 className="flex items-baseline gap-4 pt-10 font-display first:pt-0">
        <span aria-hidden="true" className="h-px w-10 shrink-0 translate-y-[-0.35em] bg-primary" />
        {block.text}
      </h2>
    );
  }

  return (
    <p
      className={cn(
        "text-pretty text-foreground/85",
        // `.drop-cap` (globals.css): three lines tall, display face, red.
        dropCap && "drop-cap",
      )}
    >
      {block.lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {linkify(line).map((segment, j) =>
            segment.kind === "link" ? (
              <a
                key={j}
                href={segment.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
              >
                {segment.href.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            ) : (
              <Fragment key={j}>{segment.text}</Fragment>
            ),
          )}
        </Fragment>
      ))}
      {endMark ? (
        <span
          aria-hidden="true"
          className="ml-2 inline-block size-2.5 translate-y-[-0.05em] bg-primary align-baseline"
        />
      ) : null}
    </p>
  );
}
