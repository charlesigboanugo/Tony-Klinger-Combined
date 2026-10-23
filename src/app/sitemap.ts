import type { MetadataRoute } from "next";

import { CATALOGUE_CATEGORIES, listCatalogue, workHref } from "@/lib/content/catalogue";
import { listPosts } from "@/lib/content/blog";
import {
  listCoachingServices,
  listCohorts,
  listCourses,
  listMembershipTiers,
  listRetreats,
  listSeries,
} from "@/lib/content/coaching";
import { listEvents } from "@/lib/content/events";
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
 *
 * Those queries read no cookies, so without a refresh time this would be built
 * once at deploy and never list anything published afterwards (note 10 §47.1).
 * Admin saves also revalidate it directly.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "/",
    "/about",
    "/about/testimonials",
    "/coaching",
    "/coaching/passes",
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
  const [posts, items, tiers, courses, series, cohorts, services, retreats, events] = await Promise.all([
    listPosts().catch(() => []),
    listCatalogue().catch(() => []),
    listMembershipTiers().catch(() => []),
    listCourses().catch(() => []),
    listSeries().catch(() => []),
    listCohorts().catch(() => []),
    listCoachingServices().catch(() => []),
    listRetreats().catch(() => []),
    listEvents().catch(() => []),
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

  // One page per published offer and event. None of these rows carries an
  // edit date, so they share the static pages' "now".
  const detailRoutes = [
    ...tiers.map((t) => `/coaching/passes/${t.slug}`),
    ...courses.map((c) => `/coaching/courses/${c.slug}`),
    ...series.map((s) => `/coaching/group-coaching/${s.slug}`),
    ...cohorts.map((c) => `/coaching/cohorts/${c.slug}`),
    ...services.map((s) => `/coaching/private-coaching/${s.slug}`),
    ...retreats.map((r) => `/coaching/retreats/${r.slug}`),
    ...events.map((e) => `/events/${e.slug}`),
  ].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...detailRoutes,
    ...postRoutes,
    ...itemRoutes,
  ];
}
