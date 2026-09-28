import type { MetadataRoute } from "next";

import { CATALOGUE_CATEGORIES, listCatalogue, workHref } from "@/lib/content/catalogue";
import { listPosts } from "@/lib/content/blog";
import { absoluteUrl } from "@/lib/urls";

/**
 * Sitemap — note 03 §41.
 *
 * PUBLIC ROUTES ONLY. Everything behind a session is deliberately absent: a
 * sitemap is a public document, so listing `/admin/...` would publish the shape
 * of the administration area to anyone who asked, for no benefit.
 *
 * Content routes are generated from the database rather than hand-listed, so a
 * newly published post or catalogue entry appears without anyone remembering to
 * add it here. Only PUBLISHED rows are returned by those queries.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "/",
    "/about",
    "/coaching",
    "/coaching/memberships",
    "/coaching/courses",
    "/coaching/group-coaching",
    "/coaching/cohorts",
    "/coaching/private-coaching",
    "/coaching/retreats",
    "/catalogue",
    "/give-get-go",
    "/blog",
    "/events",
    "/contact",
    "/academy",
    "/privacy",
    "/terms",
    "/cookies",
  ].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));

  const categoryRoutes = CATALOGUE_CATEGORIES.map((category) => ({
    url: absoluteUrl(`/catalogue/${category.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // A database outage must not fail the build or return a 500 for a crawler.
  // A sitemap missing its dynamic entries is recoverable; a broken one is not.
  const [posts, items] = await Promise.all([
    listPosts().catch(() => []),
    listCatalogue().catch(() => []),
  ]);

  const postRoutes = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.published_at ? new Date(post.published_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Only works with a page of their own; external works live elsewhere.
  const itemRoutes = items.filter((item) => workHref(item)?.external === false).map((item) => ({
    url: absoluteUrl(`/catalogue/${item.category}/${item.slug}`),
    lastModified: item.published_at ? new Date(item.published_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...postRoutes,
    ...itemRoutes,
  ];
}
