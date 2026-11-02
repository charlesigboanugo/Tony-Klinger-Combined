import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * An answer is plain text, with links written inline as `[words](/path)`
 * (owner, 2026-11-02: "get in touch" in an answer links to Contact).
 */
export type Faq = { question: string; answer: string };

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/** The answer with its `[words](/path)` turned into links to pages on this site. */
function withLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <Link
        key={at}
        href={match[2]}
        className="font-medium text-foreground underline underline-offset-4 transition-colors duration-(--dur-fast) hover:text-accent"
      >
        {match[1]}
      </Link>,
    );
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Questions and answers as a ruled list of accordions (owner, 2026-11-02, from
 * Elaine's "missing FAQs").
 *
 * Native <details>, so each opens and closes without JavaScript on a pre-built
 * page, from the keyboard, and is read in full by assistive tech. They share
 * a `name`, so ONE IS OPEN AT A TIME (owner, 2026-11-02): opening a question
 * closes the one before, keeping the list short, above all on a phone. Where the
 * browser supports animating it (`::details-content` with
 * `interpolate-size`), the answer slides open and shut; elsewhere it simply
 * appears. Still under reduced motion.
 */
export function FaqList({ items, className }: { items: Faq[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item) => (
        <details
          key={item.question}
          name="faqs"
          className={cn(
            "group [interpolate-size:allow-keywords]",
            "[&::details-content]:h-0 [&::details-content]:overflow-hidden [&[open]::details-content]:h-auto",
            "[&::details-content]:transition-[height,content-visibility] [&::details-content]:duration-(--dur-base) [&::details-content]:ease-expo [&::details-content]:[transition-behavior:allow-discrete]",
            "motion-reduce:[&::details-content]:transition-none",
          )}
        >
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-semibold [&::-webkit-details-marker]:hidden",
              "transition-colors duration-(--dur-fast) hover:text-accent",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
            )}
          >
            {item.question}
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-base) ease-expo group-open:rotate-180 motion-reduce:transition-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </summary>
          <p className="pb-5 leading-relaxed text-muted-foreground text-pretty">{withLinks(item.answer)}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * FAQs under a listing's cards, centred (owner, 2026-11-02): the Coaching Pass
 * page first, then every product listing, so each has the same block.
 */
export function FaqBlock({ items, className }: { items: Faq[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("mx-auto mt-16 max-w-3xl sm:mt-20", className)}>
      <h2 className="text-center text-balance">FAQs</h2>
      <FaqList items={items} className="mt-8" />
    </div>
  );
}
