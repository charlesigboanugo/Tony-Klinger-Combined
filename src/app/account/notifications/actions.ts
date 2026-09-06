"use server";

import { revalidatePath } from "next/cache";

import { removeFromList } from "@/lib/email/contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Marketing preferences — UK GDPR art. 21, PECR reg 22.
 *
 * The opt-out promised at checkout has to actually work: soft opt-in depends on
 * a refusal being available, so a link to a page that cannot refuse would
 * undermine the basis for every marketing email we send.
 *
 * Withdrawal is recorded, never deleted. Proving somebody opted out matters as
 * much as proving they opted in, and a removed row proves nothing.
 */
export async function updateMarketingPreference(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.email) return;

  const optIn = formData.get("optIn") === "true";
  const admin = createAdminClient();

  if (optIn) {
    await admin.rpc("record_marketing_consent", {
      p_email: user.email,
      p_source: "account_settings",
      p_consent_text: "Opted in from account notification settings.",
      p_consent_url: "/account/notifications",
      p_user_id: user.id,
    });
  } else {
    await admin.rpc("withdraw_marketing_consent", { p_email: user.email });

    // Removed from the marketing audiences immediately rather than waiting for
    // a scheduled sync — somebody who has just opted out should not receive a
    // campaign sent in the meantime.
    await removeFromList("newsletter", user.email);
    await removeFromList("customers", user.email);
    await removeFromList("members", user.email);
  }

  revalidatePath("/account/notifications");
}
