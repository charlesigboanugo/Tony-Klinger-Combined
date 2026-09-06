import { NextResponse, type NextRequest } from "next/server";

import { safeRedirect } from "@/lib/auth/safe-redirect";
import { getMfaState } from "@/lib/auth/mfa";
import { claimWelcome } from "@/lib/auth/welcome";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/urls";

/**
 * Supabase auth callback — note 05 §11, note 03 §26.
 *
 * A Route Handler rather than a page, because this answers an HTTP redirect
 * from an external system (note 02 §21). It exchanges the one-time code for a
 * session, which sets the auth cookies.
 *
 * Used by email confirmation, password recovery and invitations.
 *
 * TWO SHAPES OF LINK ARRIVE HERE, and only one of them can be read by a server.
 *
 *   ?code=…         PKCE. Exchanged for a session. Used wherever the browser
 *                   that started the flow is the one that finishes it.
 *   ?token_hash=…   A one-time token verified server-side. Used by emails sent
 *                   on somebody's behalf — an invitation has no browser that
 *                   started it, so there is no PKCE verifier to pair with.
 *
 * The third shape, GoTrue's default `#access_token=…` fragment, is deliberately
 * NOT supported: a fragment is never sent to the server, so a Route Handler
 * cannot see it at all. An invitation that arrives that way lands here with no
 * `code` and is bounced to sign-in as a broken link — which is exactly what
 * happened before the invite template was pointed at `token_hash`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // NOT request.nextUrl.origin: that reflects the hostname the server was
  // started with, so `next dev -H 0.0.0.0` makes it `http://0.0.0.0:3000` —
  // an address a browser cannot route to (see src/lib/urls.ts).
  const origin = requestOrigin(request.headers);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // `next` arrives in a URL we generated, but it still round-trips through the
  // user's email client, so it is validated like any other input (note 05 §36).
  const next = safeRedirect(searchParams.get("next"));

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`);
  }

  const supabase = await createClient();

  // The token type comes from the link and is therefore untrusted. Checked
  // against the kinds of email this application actually sends, so an
  // unexpected value is refused rather than passed through to the Auth server.
  const OTP_TYPES = ["invite", "signup", "recovery", "email_change", "magiclink"] as const;
  type OtpType = (typeof OTP_TYPES)[number];
  const isOtpType = (value: string | null): value is OtpType =>
    value !== null && (OTP_TYPES as readonly string[]).includes(value);

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : isOtpType(type)
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash!, type })
      : { data: null, error: new Error("unsupported link type") };

  if (error) {
    // Expired or already-used link. Say so without echoing provider detail
    // (note 05 §35).
    return NextResponse.redirect(`${origin}/auth/sign-in?error=invalid_link`);
  }

  // Identities are linked on VERIFIED email address (note 05 §7.1).
  //
  // If a provider hands us an address it has not confirmed, accepting it would
  // let someone sign in as an address they do not control — and because
  // Supabase links identities by email, that would attach their session to an
  // existing customer's account, along with that customer's orders and
  // entitlements. Refuse instead, and end the session we just created.
  const user = data?.user;
  if (user) {
    const identity = user.identities?.find((i) => i.provider !== "email");
    if (identity) {
      const claims = identity.identity_data ?? {};
      const verified =
        claims.email_verified === true || claims.email_verified === "true";
      if (!verified) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/auth/sign-in?error=unverified_email`,
        );
      }
    }
  }

  // Password recovery also lands here, and someone resetting a forgotten
  // password is not a new arrival. Excluded explicitly rather than inferred:
  // this is a value we put in the link ourselves, so it is reliable, whereas
  // the `type` query parameter is not present on every provider's callback.
  // Compared on the PATH, because an invitation carries `?invited=1` so the
  // password form can word itself for somebody who has never had one.
  const settingAPassword = next.split(/[?#]/)[0] === "/auth/reset-password";

  let destination = next;

  if (!settingAPassword) {
    // Covers the three routes in that have no confirmation email of their own —
    // magic link, Google, and the confirmation click after a password sign-up.
    if (await claimWelcome()) {
      destination = `/welcome?next=${encodeURIComponent(next)}`;
    }
  }

  /*
    The second factor belongs immediately after the first one, whichever the
    first one was — note 05 §11.1. A magic link or a Google sign-in is a
    completed first step exactly as a password is, so an account holding a key
    is challenged here rather than on some later page that happens to gate.

    Setting a password is the exception: an invitee has no key yet, and somebody
    recovering an account must be able to finish before anything else is asked
    of them.
  */
  if (!settingAPassword) {
    const mfa = await getMfaState();
    if (mfa.current !== "aal2" && mfa.next === "aal2") {
      return NextResponse.redirect(
        `${origin}/auth/2fa?next=${encodeURIComponent(destination)}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
