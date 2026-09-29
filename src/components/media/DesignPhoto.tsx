import Image from "next/image";
import type { ReactNode } from "react";

import { PhotoCredit } from "@/components/media/PhotoCredit";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils/cn";

/**
 * Design photography from `public/images/` — note 08 §60.1.2, note 10 §42.3.
 *
 * Every photo the layout is built around goes through one of these, so the
 * photographer's credit (`<PhotoCredit>`) can never be forgotten on a new usage.
 * Each file is placed ONCE across the site; `src/lib/site/design-photos.ts`
 * records where, so a second use is visible before it is made.
 *
 * Four formats:
 *   DesignPhoto  a framed photo beside or within text
 *   PhotoBanner  a full-bleed parallax field, optionally carrying a line
 *   PhotoMosaic  an editorial grid of several frames with one shared credit
 *   PhotoSplit   the photo fills half the screen edge to edge, words beside
 *
 * Page rules (owner's, note 10 §42.3): a page's first three photos each use a
 * different format (a fourth may repeat one), and never three photo sections
 * in a row — a section without a photo has to break them up.
 */

export type DesignImage = {
  src: string;
  alt: string;
  /** Tailwind `object-*` position, for photos whose subject is off-centre. */
  focus?: string;
};

export function DesignPhoto({
  image,
  aspect = "aspect-4/5",
  sizes = "(min-width: 1024px) 40vw, 100vw",
  priority = false,
  parallax = false,
  className,
  creditClassName = "text-muted-foreground",
}: {
  image: DesignImage;
  aspect?: string;
  sizes?: string;
  priority?: boolean;
  /** A slow drift inside the frame — the frame stays put, the photo moves. */
  parallax?: boolean;
  className?: string;
  creditClassName?: string;
}) {
  const img = (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      quality={90}
      sizes={sizes}
      className={cn("object-cover", image.focus)}
    />
  );

  return (
    <figure className={className}>
      <div
        className={cn(
          "relative overflow-hidden rounded-(--radius-lg) bg-surface-muted shadow-lift",
          aspect,
        )}
      >
        {parallax ? (
          <Parallax
            speed={0.06}
            className="absolute inset-x-0 top-[-8%] h-[116%]"
          >
            {img}
          </Parallax>
        ) : (
          img
        )}
      </div>
      <PhotoCredit src={image.src} className={creditClassName} />
    </figure>
  );
}

export function PhotoBanner({
  image,
  children,
  height = "h-[62vh] min-h-88 max-h-176",
  align = "start",
  priority = false,
}: {
  image: DesignImage;
  /** A line set over the photo — a quote, a heading, a call to action. */
  children?: ReactNode;
  height?: string;
  align?: "start" | "center";
  /** Only when the banner opens the page — it is then the largest paint. */
  priority?: boolean;
}) {
  return (
    <figure
      className={cn(
        "relative isolate overflow-hidden bg-secondary text-block-foreground",
        height,
      )}
    >
      {/* Taller than the frame so the drift never exposes an edge. Framed
          high by default: these are portraits, and a centred crop of a wide
          field takes the top of the head off. */}
      <Parallax
        speed={0.08}
        className="absolute inset-x-0 top-[-10%] -z-10 h-[120%]"
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority={priority}
          fetchPriority={priority ? "high" : undefined}
          quality={90}
          sizes="100vw"
          className={cn("object-cover object-[50%_22%]", image.focus)}
        />
      </Parallax>
      {/* Weighted to the bottom, where the words sit. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/25 to-black/5"
      />

      <div
        className={cn(
          // Same measure as the default Container, so the banner's words line
          // up with the content column above and below, not with the header.
          "mx-auto flex h-full w-full max-w-304 flex-col justify-end px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8",
          align === "center" && "items-center text-center",
        )}
      >
        {children ? <Reveal className="max-w-3xl">{children}</Reveal> : null}
      </div>
      <PhotoCredit src={image.src} variant="overlay" />
    </figure>
  );
}

export function PhotoMosaic({
  images,
  sizes = "(min-width: 1024px) 30vw, 50vw",
}: {
  images: DesignImage[];
  sizes?: string;
}) {
  // An editorial rhythm rather than an even grid: the first frame leads tall,
  // the rest tile beside it.
  return (
    <figure>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        {images.map((image, i) => (
          <Reveal
            key={image.src}
            delay={i * 70}
            className={cn(
              "relative overflow-hidden rounded-(--radius-lg) bg-surface-muted",
              i === 0
                ? "col-span-2 row-span-2 aspect-4/3 lg:aspect-auto"
                : "aspect-4/3",
            )}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              quality={90}
              sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : sizes}
              className={cn(
                "object-cover transition-transform duration-(--dur-slow) ease-expo hover:scale-[1.03] motion-reduce:transform-none",
                image.focus,
              )}
            />
          </Reveal>
        ))}
      </div>
      <PhotoCredit
        src={images.map((image) => image.src)}
        className="text-muted-foreground"
      />
    </figure>
  );
}

/**
 * The photo fills one half of the screen edge to edge; the words sit in the
 * other half. Distinct from `DesignPhoto` (a frame inside the text column) and
 * `PhotoBanner` (words over the photo). The credit sits on the photo's corner,
 * as there is no margin beneath an edge-to-edge half.
 */
export function PhotoSplit({
  image,
  children,
  side = "left",
  split = "half",
  className,
}: {
  image: DesignImage;
  children: ReactNode;
  side?: "left" | "right";
  /**
   * "text" gives the words the larger share (5:7) — for a split that carries
   * several paragraphs, where a half-width column squeezes them into a long,
   * narrow ribbon.
   */
  split?: "half" | "text";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid",
        // "text": the photo takes 3/8 plus a third of the old gap (owner,
        // 2026-09-25: a touch narrower than 5/12, so the words widen and the
        // section — whose height follows the words — comes down with it).
        split === "text"
          ? "lg:grid-cols-[calc(37.5%+1.3333rem)_minmax(0,1fr)] xl:grid-cols-[calc(37.5%+2rem)_minmax(0,1fr)]"
          : "lg:grid-cols-2",
        className,
      )}
    >
      <figure
        className={cn(
          "relative min-h-88 overflow-hidden bg-surface-muted sm:min-h-112 lg:min-h-144",
          side === "right" && "lg:order-2",
        )}
      >
        {split === "text" ? (
          // No drift for the text-weighted split: the parallax layer is 16%
          // taller than the frame, and that overshoot is what cropped the top
          // of Tony's head. Here the whole height of the photo shows.
          <Image
            src={image.src}
            alt={image.alt}
            fill
            quality={90}
            sizes="(min-width: 1024px) 45vw, 100vw"
            // The photo's own focus replaces the default rather than joining
            // it: two object-position classes on one element resolve by
            // stylesheet order, not by the order written, and `object-top`
            // silently won.
            className={cn("object-cover", image.focus ?? "object-top")}
          />
        ) : (
          <Parallax
            speed={0.06}
            className="absolute inset-x-0 top-[-8%] h-[116%]"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              quality={90}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className={cn("object-cover object-[50%_20%]", image.focus)}
            />
          </Parallax>
        )}
        <PhotoCredit src={image.src} variant="overlay" />
      </figure>
      <div
        className={cn(
          "flex items-center px-4 sm:px-10 lg:px-16",
          split === "text"
            ? "py-16 sm:py-20 lg:py-8 lg:pl-12 xl:pr-24 xl:pl-20"
            : "py-14 sm:py-20 xl:px-24",
        )}
      >
        <div className={split === "text" ? "max-w-3xl" : "max-w-xl"}>{children}</div>
      </div>
    </section>
  );
}
