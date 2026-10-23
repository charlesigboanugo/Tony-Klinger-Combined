import type { MetadataRoute } from "next";

import { SITE_NAME } from "@/lib/seo/metadata";

/**
 * Web app manifest: the name, icon and colours a phone uses when someone adds
 * the site to their home screen. It opens in the browser as normal — there is
 * no offline app behind it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "Film producer, author and coach. Courses, coaching, cohorts and retreats for filmmakers and writers.",
    start_url: "/",
    display: "browser",
    background_color: "#f6f4ef",
    theme_color: "#0f1513",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
