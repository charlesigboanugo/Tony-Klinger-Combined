import type { ReactNode } from "react";

import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

/**
 * Page title block — note 10 §9 typography hierarchy.
 *
 * The hierarchy is carried by SIZE and FACE, not by weight alone. An eyebrow in
 * tracked-out small caps, a display serif headline, then a lead paragraph at a
 * larger size than body copy. That three-step drop is what makes a page feel
 * designed rather than generated; a page where the h1 is simply bold body text
 * is the single most common tell.
 *
 * The lead is measure-limited. A description running the full width of a wide
 * container is physically hard to read — the eye loses the line on the return
 * sweep past roughly 75 characters.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-6 sm:mb-14",
        centered
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      {/*
        `w-full` pins the block to the container width so `max-w-3xl` is the
        only thing deciding the measure. The centred variant is
        `flex flex-col items-center`, where a child would otherwise size to
        fit-content and vary with the length of the title.
      */}
      <div className={cn("w-full space-y-4", centered && "max-w-3xl")}>
        {eyebrow ? (
          <Reveal as="p" className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {eyebrow}
          </Reveal>
        ) : null}

        <Reveal
          as="h1"
          delay={eyebrow ? 60 : 0}
          className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
        >
          {title}
        </Reveal>

        {description ? (
          <Reveal
            as="p"
            delay={120}
            className={cn(
              "measure text-lg leading-relaxed text-muted-foreground text-pretty",
              centered && "mx-auto",
            )}
          >
            {description}
          </Reveal>
        ) : null}
      </div>

      {actions ? (
        <Reveal delay={180} className="flex shrink-0 flex-wrap gap-3">
          {actions}
        </Reveal>
      ) : null}
    </div>
  );
}
