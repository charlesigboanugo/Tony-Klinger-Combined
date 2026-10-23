import type { Metadata } from "next";

import { publicStorageUrl } from "@/lib/storage/public-url";

export const SITE_NAME = "Tony Klinger";

/**
 * The share card used when a page has no picture of its own: Tony beside his
 * name and trades, 1200×630, the size every network crops to. A JPEG because
 * not every link preview reads WebP.
 */
export const DEFAULT_SHARE_IMAGE = {
  url: "/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "Tony Klinger — producer, author and coach",
};

export type ShareImage = { url: string; alt?: string } | { storagePath: string | null; alt?: string };

/**
 * Metadata for one public page: title, description, canonical address, and
 * the Open Graph and X card that a shared link shows.
 *
 * Every public page goes through this. Next merges metadata one key deep, so
 * a page that set its own `openGraph` would drop the layout's image and site
 * name; building the whole set here keeps them on every page. Relative
 * addresses resolve against `metadataBase`, set in the root layout.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  absoluteTitle = false,
}: {
  title: string;
  description?: string | null;
  /** The page's own address, e.g. `/coaching/courses`. */
  path: string;
  /** The page's own picture; the share card when absent or unresolvable. */
  image?: ShareImage | null;
  type?: "website" | "article";
  /** True for the home page, whose title already carries the name. */
  absoluteTitle?: boolean;
}): Metadata {
  const resolved = resolveImage(image);
  const desc = description ?? undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: "en_GB",
      title,
      description: desc,
      url: path,
      images: [resolved],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [resolved],
    },
  };
}

function resolveImage(image: ShareImage | null | undefined) {
  if (!image) return DEFAULT_SHARE_IMAGE;
  const url = "url" in image ? image.url : publicStorageUrl(image.storagePath);
  return url ? { url, alt: image.alt } : DEFAULT_SHARE_IMAGE;
}
