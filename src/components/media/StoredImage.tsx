import Image from "next/image";

import { publicStorageUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils/cn";

/**
 * An image held in Supabase Storage — note 02 §37, note 10 §16, §35.
 *
 * Wraps next/image rather than <img> so the file is resized and re-encoded to
 * AVIF/WebP at the edge. The originals here are camera-sized — the median is
 * 200 KB but the tail runs to 15 MB — so serving them raw would mean a
 * multi-megabyte download for a thumbnail.
 *
 * Renders nothing when there is no path. A missing cover is an ordinary state
 * (twelve catalogue items genuinely have none), and a broken image icon is
 * worse than a clean absence. Callers pair this with a designed fallback.
 *
 * ALT TEXT IS REQUIRED by the type. An image with no alt is invisible to a
 * screen reader, and these are content images, not decoration — if one ever IS
 * decorative, pass an explicit empty string, which is a deliberate choice
 * rather than an omission.
 */

type Common = {
  path: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /**
   * "eager" loads without waiting for the viewport, but — unlike `priority` —
   * without preloading or raising fetch priority. For tiny decorative images
   * that paint above the fold: the blurred 64px backdrops behind the catalogue
   * heroes are what the browser measures as Largest Contentful Paint (they
   * cover the whole hero), so leaving them lazy delayed LCP on every catalogue
   * page, while promoting them to `priority` would put them ahead of the real
   * posters.
   */
  loading?: "eager" | "lazy";
  /**
   * 90 for anything shown large — poster and cover art has flat gradients that
   * band badly at the default 75. Leave unset for thumbnails and grids.
   */
  quality?: 75 | 90;
  /**
   * How the image sits in its frame. An explicit prop rather than an
   * `object-contain` class passed through `className`, because `cn()` is a
   * plain join with no conflict resolution — both classes would land in the
   * markup and stylesheet order would silently decide the winner.
   *
   * "contain" for ARTWORK. A book jacket or film poster cropped to fit loses
   * the title printed across its top, which is the one thing identifying it.
   * "cover" for photography, where filling the frame is the point.
   */
  fit?: "cover" | "contain";
};

type Sized = Common & { width: number; height: number; fill?: false };
type Filled = Common & { fill: true; width?: never; height?: never };

export function StoredImage(props: Sized | Filled) {
  const { path, alt, className, sizes, priority, loading, quality, fit = "cover" } = props;
  const src = publicStorageUrl(path);
  if (!src) return null;

  if (props.fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        // `sizes` is not optional with `fill` — without it the browser assumes
        // 100vw and downloads a full-width image for a 300px card.
        sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
        priority={priority}
        fetchPriority={priority ? "high" : undefined}
        loading={priority ? undefined : loading}
        quality={quality}
        className={cn(fit === "contain" ? "object-contain" : "object-cover", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={props.width}
      height={props.height}
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? undefined : loading}
      quality={quality}
      className={className}
    />
  );
}
