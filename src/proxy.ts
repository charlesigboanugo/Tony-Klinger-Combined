import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env/public";
import { visitorHeaders } from "@/lib/supabase/forwarded";
import { requestOrigin } from "@/lib/urls";

/**
 * Content-Security-Policy with a per-request nonce — note 05 §35.
 *
 * WHY A NONCE AND NOT A STATIC HEADER. Next injects INLINE <script> tags to
 * hydrate every page. An XSS payload is also inline script in the same
 * document, so origin rules cannot tell the two apart — allowing one allows the
 * other. A nonce is a fresh random value per request: it goes in the header and
 * on the scripts we trust, and the browser runs only scripts carrying it. An
 * attacker cannot guess it, and yesterday's is useless.
 *
 * HOW NEXT PICKS IT UP: it parses the Content-Security-Policy header ON THE
 * REQUEST, extracts the `'nonce-…'` value, and stamps it onto its own framework
 * and page scripts automatically. `x-nonce` is set alongside purely so our own
 * code can read it via headers() if it ever needs to pass one to <Script>.
 *
 * COST: nonces require dynamic rendering, because a nonce can only be injected
 * during SSR. That is already true of 83 of this app's 85 routes — the public
 * header reads the session cookie to show sign-in state — so this gives up
 * almost nothing here.
 */
function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  // The browser talks to Supabase directly from client components (WebAuthn
  // enrolment), so its origin must be reachable by fetch and websocket.
  const supabase = publicEnv.NEXT_PUBLIC_SUPABASE_URL;

  return [
    "default-src 'self'",
    // 'strict-dynamic' lets a nonced script load further scripts it needs,
    // which is how Next loads its chunks; host allowlists are ignored by
    // browsers that honour it, so the nonce becomes the only key.
    // 'unsafe-eval' is required in development ONLY: React uses eval to rebuild
    // server error stacks in the browser. It is never sent in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind ships a real stylesheet, but Next still emits some inline style
    // during development's fast refresh.
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}' 'unsafe-inline'`}`,
    /*
      STYLE ATTRIBUTES ARE GOVERNED SEPARATELY, and must be allowed.

      Once `style-src` carries a nonce, browsers IGNORE its 'unsafe-inline' —
      and a `style="…"` attribute cannot carry a nonce. So in production every
      server-rendered style attribute was silently dropped: each
      `GeneratedCover` rendered without its gradient, and the hero's staggered
      `animationDelay`s all collapsed to zero. Development never showed it,
      because it sends no nonce. (Attributes React sets after hydration go
      through the CSSOM and are not subject to CSP, which is why client-drawn
      covers looked fine.)

      `style-src-attr` relaxes attributes only. <style> and <link> elements
      stay nonce-locked under `style-src`. A style attribute cannot execute
      script, and injecting one already requires an HTML injection that the
      nonce'd `script-src` still defends against.
    */
    "style-src-attr 'unsafe-inline'",
    // Storage images, plus data:/blob: for next/image's own placeholders.
    `img-src 'self' blob: data: ${supabase} https://i.vimeocdn.com https://i.ytimg.com`,
    // Hosted recordings (interviews, podcasts) stream from the public
    // site-media bucket (note 08 §60.1). Without this, <audio> falls back to
    // default-src 'self' and every player on the site is silently refused.
    `media-src 'self' ${supabase}`,
    "font-src 'self'",
    // Turnstile's api.js issues its own requests from the parent page, not just
    // from inside its iframe, so its origin must be reachable here too.
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")} https://challenges.cloudflare.com`,
    // Turnstile renders its challenge in an iframe, and lesson video is an
    // embedded player (note 07 §R29). Allowing the player's ORIGIN is not the
    // access control — the embed URL is withheld server-side from anyone
    // without entitlement, and a frame-src entry only says which origins may be
    // framed at all, never who may see a URL.
    "frame-src 'self' https://challenges.cloudflare.com https://player.vimeo.com https://embed.livid.tv https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    // Where forms may post. Stripe Checkout is a redirect, not a cross-origin
    // form post, so it needs nothing here.
    "form-action 'self'",
    // Clickjacking, matching the X-Frame-Options header in next.config.ts.
    "frame-ancestors 'none'",
    /*
      PRODUCTION ONLY, and it has to be.

      `upgrade-insecure-requests` rewrites http:// to https:// for everything the
      page loads OR NAVIGATES TO. In development the site is served over plain
      http, so a same-origin redirect — `/account/security/mfa?required=1`,
      resolved by the browser against http://localhost:3000 — was upgraded to
      https://localhost:3000, which nothing is listening on and which is a
      different origin. Chrome refused it with

        Unsafe attempt to load URL https://localhost:3000/… from frame with URL
        http://localhost:3000/admin. Domains, protocols and ports must match.

      The redirect simply died, so the second-factor gate looked broken in
      development while being correct in production. In production every URL is
      already https and the directive costs nothing, which is exactly why the
      failure only ever showed up locally.
    */
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Proxy — request-level session refresh and a coarse authentication gate.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; the runtime is Node and is
 * not configurable. This is the "current stable Next.js equivalent" that note
 * 02 §21.1 anticipated.
 *
 * THIS IS NOT THE SECURITY MODEL (note 02 §21.1, note 05 §15, note 06 §2).
 * It refreshes the auth cookies and bounces obviously-unauthenticated requests
 * so they do not reach a page that would only redirect them anyway. Every route
 * it lets through must still authorize itself server-side, and the database
 * must still enforce ownership through RLS. Next's own guidance is that the
 * proxy layer is for optimistic checks, not session management or authorization.
 *
 * Keep it thin: it runs on every matched request.
 */

/** Route prefixes that require a session. Authorization happens server-side. */
const REQUIRES_SESSION = ["/account", "/bookings", "/admin", "/welcome"] as const;

function requiresSession(pathname: string): boolean {
  if (REQUIRES_SESSION.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }

  // `/academy` itself is a public landing page with a sign-in entry point
  // (note 03 §18, note 05 §16). Everything beneath it requires a session.
  return pathname.startsWith("/academy/");
}

/**
 * Build the post-sign-in return target.
 *
 * Only ever a path from this request — never a caller-supplied URL — so this
 * cannot become an open redirect (note 05 §36).
 */
function signInUrl(request: NextRequest): URL {
  // Built from configuration, not from `request.url`, which carries the bind
  // hostname and would produce http://0.0.0.0:3000 (see src/lib/urls.ts).
  // The path and query below still come from the request — only the host must
  // not.
  const url = new URL("/auth/sign-in", requestOrigin(request.headers));
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next !== "/") url.searchParams.set("next", next);
  return url;
}

export async function proxy(request: NextRequest) {
  // crypto.randomUUID is available on the Node runtime the proxy runs on.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  /**
   * Request headers carrying the nonce, rebuilt on demand.
   *
   * Rebuilt rather than captured once because Supabase mutates
   * `request.cookies` while refreshing the session, and the response must be
   * constructed from the request as it stands AFTER that mutation — otherwise
   * the refreshed auth cookie is dropped and the user is signed out.
   */
  const headersWithNonce = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    /*
      The path being requested, so a LAYOUT can name it.

      A layout has no access to the URL, so the admin layout's second-factor
      gate could only ever send the operator back to `/admin` — a deep link
      followed while signed in at aal1 was lost at the challenge. The proxy
      already rebuilds these headers on every request, so carrying the path
      costs nothing. It is set by us on the request, never read from the client.
    */
    headers.set("x-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: headersWithNonce() } });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: visitorHeaders(request.headers) },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: headersWithNonce() } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Responses that set auth cookies must not be cached by a CDN or
          // reverse proxy, or one user's token can be served to another.
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    },
  );

  // getUser() revalidates against the Auth server and refreshes the session.
  // Do not replace it with getSession(), which trusts the cookie as-is.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && requiresSession(request.nextUrl.pathname)) {
    const redirectResponse = NextResponse.redirect(signInUrl(request));
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }

  response.headers.set("Content-Security-Policy", csp);
  /*
    Ask Chrome and Edge for the device model and real platform version, so
    "Signed-in devices" can say "Pixel 8" or "Windows 11" (note 05 §11.2).
    Sent from then on to this origin only; the sign-in page's own load is
    enough for the sign-in that follows to carry them. No Critical-CH: a
    retried navigation on first visit costs more than it is worth.
  */
  response.headers.set("Accept-CH", "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version");
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /api/*      route handlers authenticate themselves; a Stripe webhook
     *                or cron call must never be redirected to a sign-in page
     *  - /_next/*    framework assets
     *  - static files
     */
    {
      source:
        "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)",
      // Skip next/link prefetches. A prefetch fetches HTML the browser may
      // never render; giving it its own nonce wastes a session refresh and, if
      // that HTML is later used, its nonce no longer matches the live header.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
