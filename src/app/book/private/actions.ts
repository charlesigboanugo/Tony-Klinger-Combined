"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Book a private coaching time — note 09 §36.
 *
 * PAY FIRST, THEN BOOK (owner, 2026-10-08), for one session and for a pack
 * alike. Until then one session was booked first and paid for while the time
 * was held; the two ways of buying the same thing worked in opposite orders.
 *
 *   1. The customer buys a session, or a pack, through checkout like anything
 *      else. That grants sessions to use (migration 0012).
 *   2. Here they choose a time. `hold_private_coaching_slot` locks the slot and,
 *      finding an unspent session, books it outright.
 *
 * Someone with no session to use is sent to buy one. The database function can
 * still return a HOLD for them (it predates this rule); a hold is released at
 * once rather than turned into a payment, so nothing is left reserved.
 *
 * The browser names only the slot. The service is read from the database.
 */
export type PrivateBookingState = { error?: string };

const MESSAGES: Record<string, string> = {
  taken: "Someone has just taken that time. Please choose another.",
  past: "That time is too soon to book now. Please choose another.",
  not_found: "That time is no longer available. Please choose another.",
  not_authenticated: "Please sign in to book.",
  held: "You have no session to book with. Buy a session first, then choose your time.",
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
