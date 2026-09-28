"use server";

import { revalidatePath } from "next/cache";

import { queueEmail } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";

/**
 * Booking mutations — note 09 §30, §34.
 *
 * The work happens in a database function so capacity, entitlement consumption
 * and the booking row all move together. Doing it here in three steps would let
 * two requests oversell the last seat (note 08 §65).
 *
 * The server decides; the browser only asks (note 09 §53).
 */
export type BookingState = { error?: string; success?: string };

const MESSAGES: Record<string, string> = {
  full: "That session is fully booked. Try another date.",
  not_entitled:
    "You don't have access to book this session. It's included with the series, or you can buy credits.",
  already_booked: "You already have a place on that session.",
  past: "That session has already started.",
  unavailable: "That session isn't open for booking.",
  not_found: "We couldn't find that session.",
  not_authenticated: "Please sign in to book.",
};

export async function bookSessionAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const sessionId = formData.get("sessionId")?.toString();
  if (!sessionId) return { error: "Choose a session first." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_group_session", {
    p_session_id: sessionId,
  });

  if (error) return { error: "We couldn't complete that booking. Please try again." };

  const result = data as {
    status: string;
    consumed_credit?: boolean;
    booking_id?: string;
  } | null;

  if (result?.status === "ok") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email && result.booking_id) {
      // Keyed on the booking, so a repeated submission cannot send a second
      // confirmation (note 09 §56).
      await queueEmail({
        idempotencyKey: `booking:${result.booking_id}`,
        template: "booking_confirmed",
        to: user.email,
        payload: { title: "Group coaching session" },
      });
    }

    revalidatePath("/bookings");
    revalidatePath("/account/bookings");
    // No standalone Academy calendar (removed 2026-09-05) — the dashboard's
    // "Coming up" and the Academy Coaching page are what show this now.
    revalidatePath("/academy");
    revalidatePath("/academy/coaching");
    return {
      success: result.consumed_credit
        ? "Booked — one session credit used."
        : "Booked. This is included in your access, so no credit was used.",
    };
  }

  return { error: MESSAGES[result?.status ?? "not_found"] ?? MESSAGES.not_found };
}

export async function cancelBookingAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const bookingId = formData.get("bookingId")?.toString();
  if (!bookingId) return { error: "Nothing to cancel." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
  });

  if (error) return { error: "We couldn't cancel that booking. Please try again." };

  const result = data as { status: string; credit_returned?: boolean } | null;

  if (result?.status === "ok") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      await queueEmail({
        idempotencyKey: `booking-cancel:${bookingId}`,
        template: "booking_cancelled",
        to: user.email,
        payload: { creditReturned: result.credit_returned ?? false },
      });
    }

    revalidatePath("/bookings");
    revalidatePath("/account/bookings");
    revalidatePath("/academy/coaching");
    return {
      success: result.credit_returned
        ? "Cancelled — your session has been returned to your account to rebook."
        : "Cancelled. This was too close to the start time for the credit to be returned.",
    };
  }

  if (result?.status === "too_late") {
    return {
      error:
        "Private sessions can't be cancelled online within 48 hours of the start. Please get in touch and we'll help.",
    };
  }

  if (result?.status === "paid_ticket") {
    return { error: "This is a paid ticket. Get in touch and we'll sort out your place and any refund." };
  }

  return { error: "We couldn't find that booking." };
}
