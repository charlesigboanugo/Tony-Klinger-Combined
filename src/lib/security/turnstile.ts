import "server-only";

/**
 * Cloudflare Turnstile verification — note 05 §35.
 *
 * The widget's token proves a browser solved the challenge. It is worth nothing
 * until verified SERVER-SIDE against Cloudflare: the value arrives in a form
 * post, so anything sent from the client can be fabricated.
 *
 * Tokens are single-use and short-lived, which is what stops a script solving
 * the challenge once and replaying that token forever.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: string };

export function turnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

export async function verifyTurnstile(
  token: string | null,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // FAIL CLOSED IN PRODUCTION, OPEN IN DEVELOPMENT.
  //
  // A missing secret in production means the protection is silently absent on a
  // public form — refuse instead. Locally it just means nobody has set up keys
  // yet, and blocking the form would make the feature untestable.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "captcha_unavailable" };
    }
    return { ok: true };
  }

  if (!token) return { ok: false, reason: "captcha_missing" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    // Cloudflare uses this to spot a token solved on one address and replayed
    // from another.
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) return { ok: false, reason: "captcha_unreachable" };

    const result = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (result.success) return { ok: true };

    // Logged, never shown: the codes describe our configuration, not the
    // visitor's mistake (note 05 §35).
    console.warn("turnstile rejected", { codes: result["error-codes"] });
    return { ok: false, reason: "captcha_failed" };
  } catch (error) {
    console.error("turnstile verification failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    // A Cloudflare outage must not permanently break the contact form, but
    // treating an outage as a pass would remove the protection exactly when an
    // attacker could cause one. Refuse, and let the visitor retry.
    return { ok: false, reason: "captcha_unreachable" };
  }
}
