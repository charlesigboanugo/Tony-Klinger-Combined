import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * The way back from a detail page — note 04 §32.3.
 *
 * A plain text link ("← All orders" in muted grey) was the pattern almost
 * every detail page across the site used for this, and it is too easy to
 * miss: low contrast by design, no button affordance, competing with
 * whatever else sits near the top of the page. This is the same `outline`
 * button already used correctly in a few places (checkout's return states),
 * generalised into one component so "how do I get back to where I was" has
 * one obvious, consistent answer everywhere rather than a link style in most
 * places and a button in a few.
 */
export function BackLink({
  href,
  children,
  className,
  inline = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /**
   * In a row with other things (a header, a bar), so without the space below
   * it that it keeps above a page's title.
   */
  inline?: boolean;
}) {
  return (
    // A long label (a course's title on a phone) shortens with an ellipsis
    // rather than pushing the button off the screen.
    <ButtonLink href={href} variant="outline" size="sm" className={cn("max-w-full", !inline && "mb-6", className)}>
      <span aria-hidden="true">&larr;</span>
      <span className="min-w-0 truncate">{children}</span>
    </ButtonLink>
  );
}
