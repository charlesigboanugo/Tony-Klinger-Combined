"use server";

import { redirect } from "next/navigation";

import { DEFAULT_REDIRECT, safeRedirect } from "@/lib/auth/safe-redirect";
import { getMfaState } from "@/lib/auth/mfa";
import { claimWelcome } from "@/lib/auth/welcome";
import { publicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  forgotPasswordSchema,
  magicLinkSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type AuthFormState,
} from "@/lib/validation/auth";

/**
 * Authentication Server Actions — note 05 §6–§9, note 02 §21.
 *
 * These are UI-triggered mutations, so they are Server Actions rather than
 * Route Handlers. Sign-out in particular must not be reachable by GET: a
 * GET-able sign-out URL can be triggered by any image tag on any site.
 *
 * `redirect()` throws, so it is always called OUTSIDE try/catch — otherwise the
 * catch swallows the redirect and the user silently stays put.
 *
 * Error copy never repeats Supabase's message verbatim (note 05 §35).
 */

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately identical whether the address is unknown or the password is
    // wrong. Distinguishing them turns the form into an account-enumeration
    // oracle (note 05 §35).
    return { error: "That email address and password do not match." };
  }

  const next = safeRedirect(formData.get("next")?.toString());

  // First sign-in only. Returns false every other time, so this costs one
  // cheap UPDATE and changes nothing for a returning customer.
  const firstTime = await claimWelcome();
  const destination = firstTime
    ? `/welcome?next=${encodeURIComponent(next)}`
    : next;

  redirect(await afterPassword(destination));
}

/**
 * Insert the second-factor step, if this account has one — note 05 §11.1.
 *
 * The password is one of two steps, so the key is asked for HERE rather than
 * whenever the person later happens to open a page that gates on it. Before
 * this, a staff member met the prompt only on reaching Admin, and a customer
 * who had registered a key was never asked at all.
 *
 * The welcome flag is claimed before the challenge rather than after, because
 * claiming is what tests it. Somebody who abandons the challenge has spent it
 * and will land on their account next time instead of the welcome page — a
 * cosmetic loss, and the alternative is carrying an unclaimed flag through a
 * step the person may never complete.
 */
async function afterPassword(destination: string): Promise<string> {
  const { current, next } = await getMfaState();
  if (current === "aal2" || next !== "aal2") return destination;
  return `/auth/2fa?next=${encodeURIComponent(destination)}`;
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const next = safeRedirect(formData.get("next")?.toString());
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: "We could not create that account. Please try again." };
  }

  // The application profile is created by a database trigger on auth.users,
  // not here, so an account can never exist without one (note 08 §23).
  return {
    success:
      "Check your email to confirm your account. The link expires shortly.",
  };
}

/**
 * Magic link — note 05 §7.1.
 *
 * No confirmation email is involved: receiving the link IS the proof of inbox
 * ownership, which is why `enable_confirmations` does not apply to this path.
 *
 * The response is identical whether or not the address has an account, for the
 * same reason sign-in errors are uniform — otherwise this becomes an
 * account-enumeration oracle.
 */
export async function magicLinkAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const next = safeRedirect(formData.get("next")?.toString());
  const supabase = await createClient();

  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  return {
    success: "If that email address has an account, a sign-in link is on its way.",
  };
}

/**
 * Google OAuth — note 05 §7.1. The only external provider.
 *
 * Supabase returns a URL to redirect to; the provider then returns the user to
 * /auth/callback, which exchanges the code exactly as it does for magic links.
 *
 * Google having already verified the address is why no confirmation email
 * follows. That holds only while Google asserts the address is verified — an
 * unverified one must not be accepted, or an address the person does not
 * control could be linked to an existing account (note 05 §7.1).
 */
export async function googleSignInAction(formData: FormData) {
  const next = safeRedirect(formData.get("next")?.toString());
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data?.url) {
    redirect("/auth/sign-in?error=oauth_unavailable");
  }

  redirect(data.url);
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/reset-password`,
  });

  // Always the same response, whether or not the address exists. Anything else
  // reveals who holds an account here.
  return {
    success:
      "If that email address has an account, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();

  // The recovery link established a session via /auth/callback. Without one
  // there is nothing to update — and no way to prove who is asking.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "This reset link is no longer valid. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "We could not update your password. Please try again." };
  }

  redirect(DEFAULT_REDIRECT);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
