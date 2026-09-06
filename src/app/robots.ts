import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/urls";

/**
 * Crawler rules — note 03 §41.
 *
 * The disallow list is not a security control: RLS and server-side
 * authorization are what actually protect these routes, and a crawler that
 * ignores this file still gets a redirect to sign-in. What it prevents is the
 * SEO failure of gated, personalised or transactional pages appearing in search
 * results — a customer finding someone else's `/account/orders` in Google would
 * be alarming even though the page would refuse to load for them.
 *
 * `/auth/` is excluded because indexed sign-in pages attract credential-stuffing
 * traffic, and `/checkout/` because a half-finished payment flow is never a
 * useful search result.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account/",
          "/academy/",
          "/admin/",
          "/auth/",
          "/bookings/",
          "/checkout/",
          "/welcome",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
