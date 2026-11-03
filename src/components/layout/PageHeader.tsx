import type { ReactNode } from "react";

import { DesignPhoto, type DesignImage } from "@/components/media/DesignPhoto";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";
import { HERO_ACTIONS } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";

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
 *
 * With a `photo` (note 10 §42.3) the header becomes a split: the words on one
 * side, a framed portrait drifting gently on the other. Stacked on phones,
 * words first.
 *
 * With `split` (owner, 2026-11-03, for the coaching listings) the header uses
 * the width: the eyebrow, then the title on the left and the description on
 * the right starting level with it, and a hairline across the full width
 * before the cards. Stacked on phones, with the same hairline.
 */
/**
 * From lg the words start at `--hero-text-top` below the header, the height
 * every page hero shares with the home title card. A page header sits in a
 * `Section`, whose top padding is 4rem from `sm`, so it adds the rest.
 */
const HERO_START = "lg:pt-[max(0px,calc(var(--hero-text-top)-4rem))]";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "start",
  titleClassName,
  photo,
  className,
  nested = false,
  split = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: "start" | "center";
  /** For the heading alone: a narrower measure where a title reads better on two lines. */
  titleClassName?: string;
  photo?: DesignImage;
  className?: string;
  /** Set by the photo split for its inner title block, which it has
      already moved to the shared start height. */
  nested?: boolean;
  /** Title left, description right, a hairline under both (see above). */
  split?: boolean;
}) {
  if (photo) {
    return (
      <div
        className={cn(
          "mb-12 grid items-center gap-10 sm:mb-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16",
          className,
        )}
      >
        <div className={cn("space-y-6", HERO_START)}>
          <PageHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            className="mb-0 sm:mb-0"
            nested
          />
          {actions ? (
            <Reveal delay={180} className={HERO_ACTIONS}>
              {actions}
            </Reveal>
          ) : null}
        </div>
        <Reveal delay={120}>
          <DesignPhoto
            image={photo}
            aspect="aspect-4/3 lg:aspect-4/5"
            priority
            parallax
          />
        </Reveal>
      </div>
    );
  }

  if (split) {
    return (
      <div className={cn("mb-10 border-b border-border pb-10 sm:mb-14 sm:pb-12", HERO_START, className)}>
        {eyebrow ? (
          <Reveal className="mb-4">
            <Eyebrow>{eyebrow}</Eyebrow>
          </Reveal>
        ) : null}
        {/* Title and description start level, so the block reads the same
            whether the description is one line or five. */}
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-12">
          <Reveal as="h1" delay={eyebrow ? 60 : 0} className={cn("font-display text-balance lg:col-span-6", titleClassName)}>
            {title}
          </Reveal>
          {description ? (
            <Reveal
              as="p"
              delay={120}
              className="text-lg leading-relaxed text-muted-foreground text-pretty lg:col-span-6 lg:pt-2"
            >
              {description}
            </Reveal>
          ) : null}
        </div>
        {actions ? (
          <Reveal delay={180} className={cn("mt-8", HERO_ACTIONS)}>
            {actions}
          </Reveal>
        ) : null}
      </div>
    );
  }

  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-6 sm:mb-14",
        !nested && HERO_START,
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
          <Reveal>
            <Eyebrow align={centered ? "center" : "start"}>{eyebrow}</Eyebrow>
          </Reveal>
        ) : null}

        <Reveal
          as="h1"
          delay={eyebrow ? 60 : 0}
          className={cn("font-display", titleClassName)}
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
        <Reveal delay={180} className={cn("shrink-0", HERO_ACTIONS)}>
          {actions}
        </Reveal>
      ) : null}
    </div>
  );
}
