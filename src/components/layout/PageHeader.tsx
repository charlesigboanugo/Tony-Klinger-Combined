import type { ReactNode } from "react";

import { DesignPhoto, type DesignImage } from "@/components/media/DesignPhoto";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";
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
  photo,
  className,
  nested = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: "start" | "center";
  photo?: DesignImage;
  className?: string;
  /** Set by the photo split for its inner title block, which it has
      already moved to the shared start height. */
  nested?: boolean;
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
            <Reveal delay={180} className="flex flex-wrap gap-3">
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
          className="font-display"
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
