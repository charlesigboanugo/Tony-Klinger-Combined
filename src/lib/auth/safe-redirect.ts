/**
 * Validate a post-authentication return path.
 *
 * Note 05 §36: never redirect to a URL supplied through a query parameter. An
 * unvalidated `next` is an open redirect — an attacker sends
 * `/auth/sign-in?next=https://evil.example` and the victim lands off-site
 * immediately after signing in, primed to be phished.
 *
 * Only same-origin absolute paths are accepted. Everything else falls back.
 */
export const DEFAULT_REDIRECT = "/";

/**
 * Auth paths that are legitimate DESTINATIONS rather than entry points.
 *
 * `DEFAULT_REDIRECT` was `/account`, which meant sign-in ALWAYS landed there —
 * including when nothing forced the visit. The proxy only ever sets `next`
 * when it is the one redirecting an unauthenticated request to `/auth/sign-in`
 * (`signInUrl()` in `src/proxy.ts`); someone who opened sign-in on their own
 * has no `next` at all, so they were being sent to their account page instead
 * of back to the site. The two cases are meant to differ: arrived-here-forced
 * returns to the page that was asked for (via `next`, unaffected by this
 * constant), arrived-here-by-choice returns to the home page.
 *
 * The blanket `/auth/` rejection below exists to stop a sign-in bouncing back
 * to itself. Recovery is the exception: `forgotPasswordAction` deliberately
 * points the emailed link at the form that sets the new password, and without
 * this the link exchanged a session and then dropped the person on /account
 * with no way to finish resetting.
 *
 * `/auth/2fa` is the same shape of thing: a step that finishes something rather
 * than starting it. It cannot loop, because it redirects onward the moment the
 * session already holds `aal2` (note 05 §11.1).
 *
 * Matched on the PATH ONLY. An invitation points at
 * `/auth/reset-password?invited=1` so the page can say "set your password"
 * rather than "set a NEW password", and an exact-string set would silently drop
 * that person on /account with nothing to do.
 */
const AUTH_DESTINATIONS = new Set(["/auth/reset-password", "/auth/2fa"]);

/** Control characters and DEL, which can smuggle a scheme past naive checks. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function safeRedirect(
  next: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!next) return fallback;

  // Must be a root-relative path.
  if (!next.startsWith("/")) return fallback;

  // `//evil.example` and `/\evil.example` look like paths, but browsers resolve
  // them as protocol-relative URLs pointing at another origin.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;

  if (CONTROL_CHARS.test(next)) return fallback;

  // Never bounce back into the auth area — that loops. The few terminal
  // destinations there are named explicitly.
  if (next === "/auth" || next.startsWith("/auth/")) {
    const path = next.split(/[?#]/)[0];
    return AUTH_DESTINATIONS.has(path) ? next : fallback;
  }

  return next;
}
