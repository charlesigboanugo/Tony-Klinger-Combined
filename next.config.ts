import type { NextConfig } from "next";

/**
 * Image optimisation and remote asset hosts.
 *
 * `next/image` is what actually compresses and resizes: it re-encodes to AVIF or
 * WebP based on the browser's Accept header, serves the size the layout asks
 * for, and caches the result on Vercel's edge. Files served straight out of
 * `public/` or fetched with a plain <img> are CDN-cached but never re-encoded or
 * resized, so a 4 MB upload stays a 4 MB download.
 *
 * A remote host must be allowlisted here or next/image refuses it — deliberately,
 * since an open image proxy will be used as one by somebody else.
 *
 * THE HOST IS DERIVED, NOT HARDCODED. Local Supabase is 127.0.0.1:54321 and
 * production is a project-specific domain that is not yet decided. Reading it
 * from NEXT_PUBLIC_SUPABASE_URL means both work with no edit to this file, and
 * there is no chance of the two drifting apart.
 */
/** True when the configured Supabase host is a loopback or private address. */
function supabaseIsLocal(): boolean {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return false;

  try {
    const { hostname } = new URL(raw);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

function supabasePattern() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];

  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port,
        // PUBLIC objects only. Signed URLs are deliberately not optimised:
        // next/image would fetch and cache gated content on a public CDN, keyed
        // by a URL whose token expires — so the cached copy outlives the
        // permission that produced it.
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    // A malformed URL must not take the build down; the app has its own
    // validation for this variable.
    return [];
  }
}


/**
 * Security response headers — note 05 §35, note 09 §48.
 *
 * These are defence in depth, not the security model: authorization is enforced
 * server-side and RLS is the backstop. What they do is close the browser-side
 * gaps that server checks cannot reach.
 *
 * No Content-Security-Policy is set here, deliberately. A useful CSP for this
 * app needs a per-request nonce for Next's inline hydration scripts, which
 * cannot be expressed in a static header — a `unsafe-inline` CSP would be
 * security theatre, and a strict one without a nonce breaks hydration silently.
 * It belongs in `proxy.ts`, where the nonce can be generated per request, and is
 * recorded as outstanding rather than faked here.
 */
const securityHeaders = [
  // Stops a browser second-guessing a declared Content-Type. Without it, a
  // user-uploaded file served as text/plain can be sniffed as HTML and run.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Clickjacking: nothing here is intended to be framed by another site. An
  // invisible iframe over a real button is how a signed-in user is tricked into
  // clicking something they cannot see.
  { key: "X-Frame-Options", value: "DENY" },

  // Referrer leakage. A full URL sent to a third party can carry a claim token
  // or a signed storage URL in its query string.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nothing in this application uses these, so they are switched off rather
  // than left available to any embedded content.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },

  // Two years, subdomains included. HTTPS only — Vercel terminates TLS, and
  // this instructs the browser never to attempt http:// again.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // Legacy cross-origin isolation of the browsing context.
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabasePattern(),
    // Smallest first. AVIF is ~20% smaller than WebP but slower to encode;
    // Next falls back automatically for browsers that accept neither.
    formats: ["image/avif", "image/webp"],
    // Widths actually used by the layouts, so a request cannot ask Vercel for
    // an arbitrary size and bill a transformation for it.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    // Optimised results are immutable for a day; a replaced asset gets a new
    // storage path, so this never serves a stale image.
    minimumCacheTTL: 60 * 60 * 24,

    // Allowed `quality` values. Next 16 requires this allowlist — an arbitrary
    // quality in a URL is another way to bill unlimited distinct
    // transformations for one source image.
    //
    // 75 is the default and is right for thumbnails. 90 exists because this is
    // an image-led design: film posters and book covers are shown large, and
    // AVIF at 75 puts visible banding into the flat gradients that poster art
    // is full of. The step from 75 to 90 costs roughly 30% more bytes on
    // photographic content, which is worth paying on the few images a page
    // shows at size and not worth paying on a grid of sixty thumbnails.
    qualities: [75, 90],

    // Next 16 refuses to optimise an image whose host resolves to a private
    // IP. That is SSRF protection worth having: otherwise the public
    // /_next/image endpoint can be aimed at internal addresses and used to
    // probe a private network.
    //
    // Local Supabase is 127.0.0.1, so every stored image 400s with "hostname
    // resolved to private IP" until it is allowed.
    //
    // GATED ON THE SUPABASE HOST, not on NODE_ENV. `next start` sets
    // NODE_ENV=production even when running locally against local Supabase, so
    // a NODE_ENV gate leaves images broken in exactly that case. Keying it to
    // whether the configured Supabase host IS local means the flag switches
    // itself off the moment that variable points at a real domain — which is
    // the only condition under which the risk exists.
    dangerouslyAllowLocalIP: supabaseIsLocal(),
  },

  async headers() {
    return [
      {
        // Every route, including API routes and static assets.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
