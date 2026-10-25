"use server";

import { redirect } from "next/navigation";

import { hashToken } from "@/lib/commerce/claim";
import { addToList } from "@/lib/email/contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/validation/newsletter-copy";

export type ClaimState = { error?: string };

/**
 * Redeem a claim token — note 05 §29.3.
 *
 * All the real work happens in the database function, in one transaction, so a
 * failure cannot leave an order owned but without entitlements.
 */
export async function claimOrderAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const token = formData.get("token")?.toString();
  if (!token) return { error: "That claim link is incomplete." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Preserve the token through sign-in so the customer does not have to
    // return to the email.
    redirect(
      `/auth/sign-in?next=${encodeURIComponent(`/account/claim?token=${token}`)}`,
    );
  }

  // Only the hash reaches the database (note 05 §29.3).
  const { data, error } = await supabase.rpc("claim_order", {
    p_token_hash: hashToken(token),
  });

  if (error) return { error: "We couldn't complete that claim. Please try again." };

  const result = data as { status: string } | null;

  switch (result?.status) {
    case "ok":
      if (formData.get("news") === "on" && user.email) await joinNewsletter(user.id, user.email);
      redirect("/account/orders?claimed=1");
    case "expired":
      return {
        error:
          "That link has expired. Contact us and we'll get your purchase onto your account.",
      };
    case "already_claimed":
      return {
        error:
          "That purchase is already attached to another account. Contact us and we'll sort it out.",
      };
    default:
      return {
        error:
          "That claim link isn't valid. If you've already claimed this purchase, it's in your orders.",
      };
  }
}

/**
 * The news box a gift's recipient can tick when claiming (owner, 2026-10-25).
 *
 * Explicit opt-in, recorded with the wording shown before Brevo is told, as on
 * the newsletter form. `resubscribe`, as on Account → Notifications: they are
 * signed in and ticked it themselves, so it is a fresh opt-in. Never fails the
 * claim it rides on.
 */
async function joinNewsletter(userId: string, email: string) {
  const { error } = await createAdminClient().rpc("record_marketing_consent", {
    p_email: email,
    p_source: "newsletter_form",
    p_consent_text: NEWSLETTER_CONSENT_TEXT,
    p_consent_url: "/account/claim",
    p_user_id: userId,
  });
  if (error) {
    console.error("consent record failed", { message: error.message });
    return;
  }
  const sync = await addToList("newsletter", email, undefined, { resubscribe: true });
  if (!sync.ok) console.error("newsletter list sync failed", { error: sync.error });
}

/**
 * Add every paid purchase made with the signed-in customer's own confirmed
 * email — owner, 2026-10-15; note 05 §29.3.
 *
 * Needs no emailed link: holding the confirmed address is the proof that link
 * gives. Runs only when the customer asks (the button on Account and Orders),
 * never on sign-in by itself.
 */
export async function claimMyOrdersAction(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_my_orders");
  const result = data as { status: string; claimed?: number } | null;

  if (error || result?.status !== "ok" || !result.claimed) {
    redirect("/account/orders?claimed=0");
  }
  redirect("/account/orders?claimed=1");
}
