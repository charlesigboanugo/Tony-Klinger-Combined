"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Account security self-service — migration 0022, note 05 §11.1.
 *
 * Every rule is enforced in the database (`authorise_security_key_removal`,
 * `sign_out_my_session`), scoped to the caller. These actions only translate
 * the answers into words.
 */

export type KeyRemovalState = {
  error?: string;
  /** The session has not presented a key recently enough — ask for one. */
  reconfirm?: boolean;
};

export async function removeSecurityKeyAction(
  _prev: KeyRemovalState,
  formData: FormData,
): Promise<KeyRemovalState> {
  const factorId = formData.get("factorId")?.toString();
  if (!factorId) return { error: "No key given." };

  // requireSession, not requireUser: this page is where a staff account at
  // the second-factor gate manages its keys (see the account layout).
  const context = await requireSession("/account/security/mfa");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorise_security_key_removal", {
    p_factor_id: factorId,
  });

  if (error) {
    if (error.hint === "reauth") return { reconfirm: true };
    if (error.hint === "minimum") {
      return { error: `${error.message.replace(/^./, (c) => c.toUpperCase())}. Add another key first, then remove this one.` };
    }
    if (error.code === "P0002") return { error: "That key is no longer on your account." };
    return { error: "We couldn't remove that key. Please try again." };
  }

  // The gate passed and the removal is recorded; now the deletion itself.
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
    userId: context.userId,
    id: factorId,
  });
  if (deleteError) {
    return { error: "The removal was recorded but the key could not be deleted. Please try again." };
  }

  revalidatePath("/account/security");
  // Redirected rather than returned: the row holding this form is gone once
  // the list re-renders, and a message inside it would go with it.
  const name = (data as { name?: string } | null)?.name ?? "";
  redirect(`/account/security/mfa?removed=${encodeURIComponent(name || "key")}`);
}

export async function signOutSessionAction(formData: FormData) {
  const sessionId = formData.get("sessionId")?.toString();
  if (!sessionId) return;
  await requireSession("/account/security");

  const supabase = await createClient();
  await supabase.rpc("sign_out_my_session", { p_session_id: sessionId });
  revalidatePath("/account/security");
}

/** Every session except this one — Supabase's own `others` scope. */
export async function signOutOtherSessionsAction() {
  await requireSession("/account/security");
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account/security");
}
