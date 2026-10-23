/**
 * Back to the list a row was opened from (owner, 2026-10-15).
 *
 * A row opened from Media's Audio tab, or from page 3 of a search, returns
 * there — by its Back link, and after a save or a delete — not to the list's
 * first tab. The list passes its own query string along as `?from=`.
 *
 * Only the PARAMETERS of `from` are kept: the path is always the resource's
 * own list, so a crafted `from` cannot send anyone somewhere else.
 */
export function listHref(slug: string, from?: string | null): string {
  const query = new URLSearchParams(from ?? "");
  return query.size ? `/admin/${slug}?${query}` : `/admin/${slug}`;
}

/** `href` carrying the list's query string, when there is one. */
export function withFrom(href: string, from?: string | null): string {
  if (!from) return href;
  return `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
}
