import { publicEnv } from "@/lib/env/public";

/**
 * Canonical URL construction.
 *
 * Absolute URLs we send back to a browser — redirects, email links, OAuth
 * return targets — are built from configuration, never from the incoming
 * request.
 *
 * Two reasons:
 *
 * 1. **Correctness.** `request.nextUrl.origin` reflects the hostname the server
 *    was started with. Running `next dev -H 0.0.0.0` makes that literally
 *    `http://0.0.0.0:3000`, which is a bind address, not a destination — a
 *    browser refuses it outright with ERR_ADDRESS_INVALID.
 *
 * 2. **Security.** The `Host` header is supplied by the client. Building a
 *    redirect from it lets an attacker send `Host: evil.example` and have the
 *    application hand its own users a redirect off-site — host-header
 *    injection.
 *
 * Request *paths* and *query strings* remain safe to read and are used freely;
 * a path cannot point at another origin. It is only the host that must not be
 * taken from the request.
 */

/** The canonical origin for this deployment, e.g. `https://tonyklinger.com`. */
export function siteUrl(): string {
  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Absolute URL for a path on this site. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Hosts that development may legitimately be reached on.
 *
 * Development binds `0.0.0.0`, so the same server answers on localhost, the WSL
 * interface and the LAN address. Redirecting all of them to the canonical host
 * would bounce you to `localhost` from a phone on the network.
 *
 * This is an allowlist, not trust in the header: a host is echoed back only if
 * it is loopback or a private-range address, and never in production.
 */
const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

/**
 * The origin to use when redirecting this particular request.
 *
 * Production always returns the canonical site URL. Development echoes the host
 * back only when it matches the private-address allowlist above.
 */
export function requestOrigin(headers: Headers): string {
  if (process.env.NODE_ENV === "production") return siteUrl();

  const host = headers.get("host");
  if (host && DEV_HOST.test(host)) {
    const protocol = headers.get("x-forwarded-proto") ?? "http";
    return `${protocol}://${host}`;
  }

  return siteUrl();
}
