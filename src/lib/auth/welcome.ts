import "server-only";

import { queueEmail } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";

/**
 * The welcome moment — note 05 §7.1, note 09 §42.
 *
 * Called at every successful sign-in. It is a no-op on all but the first,
 * because `claim_welcome()` sets `profiles.welcomed_at` atomically and returns
 * true to exactly one caller.
 *
 * WHY FIRST SIGN-IN AND NOT SIGN-UP: only the email/password route sends a
 * confirmation message. Google and magic-link accounts are created and
 * immediately usable, with nothing sent and nothing shown. First sign-in is the
 * single point all four routes share, so putting the welcome there means every
 * new person gets the same acknowledgement regardless of how they joined.
 *
 * Never throws. A welcome that fails to queue must not stop somebody signing
 * in — the person is authenticated either way, and email is not the source of
 * truth for anything (note 09 §42).
 */
export async function claimWelcome(): Promise<boolean> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data, error } = await supabase.rpc("claim_welcome");

    // Anything other than an explicit true means somebody else already claimed
    // it, or the call failed. Both are "do not send".
    if (error || data !== true) return false;

    if (user.email) {
      const metadata = user.user_metadata ?? {};
      const name =
        typeof metadata.display_name === "string" && metadata.display_name
          ? metadata.display_name
          : typeof metadata.full_name === "string" && metadata.full_name
            ? metadata.full_name
            : user.email.split("@")[0];

      await queueEmail({
        // Keyed to the user, so even a hand-edited replay of this call cannot
        // queue a second welcome.
        idempotencyKey: `welcome:${user.id}`,
        template: "welcome",
        to: user.email,
        toName: name,
        payload: { name },
      });
    }

    return true;
  } catch (error) {
    console.error("claimWelcome failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
