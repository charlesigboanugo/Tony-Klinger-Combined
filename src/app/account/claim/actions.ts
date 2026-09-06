"use server";

import { redirect } from "next/navigation";

import { hashToken } from "@/lib/commerce/claim";
import { createClient } from "@/lib/supabase/server";

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
