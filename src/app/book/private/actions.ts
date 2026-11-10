"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Book a private coaching time — note 09 §36.
 *
 * BOOKING WITH A SESSION ALREADY HELD: a pack's, a gift's, or one returned by
 * a cancellation. `hold_private_coaching_slot` locks the slot and, finding an
 * unspent session, books it outright.
 *
 * Someone with no session to use does not come here: they choose a time and
 * pay for it through checkout, which holds the time while they pay (owner,
 * 2026-11-10; migration 0030). Should a hold come back here anyway, it is
 * released at once, so nothing is left reserved.
 *
 * The browser names only the slot. The service is read from the database.
 */
export type PrivateBookingState = { error?: string };

const MESSAGES: Record<string, string> = {
  taken: "Someone has just taken that time. Please choose another.",
  past: "That time is too soon to book now. Please choose another.",
  not_found: "That time is no longer available. Please choose another.",
  not_authenticated: "Please sign in to book.",
  held: "You have no session to book with. Choose a time and continue to payment instead.",
};

export async function bookPrivateSlotAction(
  _prev: PrivateBookingState,
  formData: FormData,
): Promise<PrivateBookingState> {
  const slotId = formData.get("slotId")?.toString();
  if (!slotId) return { error: "Choose a time first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: MESSAGES.not_authenticated };

  const { data, error } = await supabase.rpc("hold_private_coaching_slot", { p_slot_id: slotId });
  if (error) return { error: "We couldn't book that time. Please try again." };

  const result = data as { status: string; booking_id?: string } | null;

  if (result?.status === "booked") {
    revalidatePath("/account/bookings");
    revalidatePath("/academy");
    revalidatePath("/academy/coaching");
    redirect("/academy/coaching?booked=private");
  }

  // No session to spend: free the time straight away.
  if (result?.status === "held" && result.booking_id) {
    await createAdminClient()
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), hold_expires_at: null })
      .eq("id", result.booking_id);
  }

  return { error: MESSAGES[result?.status ?? "not_found"] ?? MESSAGES.not_found };
}
