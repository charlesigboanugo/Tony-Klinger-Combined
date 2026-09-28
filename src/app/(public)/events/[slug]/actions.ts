"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Event place actions — note 03 §8.1.
 *
 * Each is one database function (migrations 0017, 0018), which locks what it
 * must and reports a status. The ticket email is queued by the database when
 * the booking row is written, in the same transaction, so every way a ticket
 * can come into being (free registration, a paid order, a claimed guest
 * order) sends exactly one. The server decides; the browser only asks
 * (note 09 §53).
 */
export type EventActionState = {
  error?: string;
  success?: string;
  signIn?: boolean;
  bookingId?: string;
};

const MESSAGES: Record<string, string> = {
  full: "Every place has just been taken. Join the waiting list and we will email you if one opens.",
  already_booked: "You already have a place. Your ticket is in your bookings.",
  past: "This event has already started.",
  unscheduled: "Registration opens once the date is confirmed.",
  paid: "This event is ticketed.",
  not_found: "We couldn't find that event.",
};

function read(formData: FormData) {
  return {
    eventId: formData.get("eventId")?.toString() ?? "",
    slug: formData.get("slug")?.toString() ?? "",
  };
}

export async function registerForEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const { eventId, slug } = read(formData);
  if (!eventId || !slug) return { error: MESSAGES.not_found };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_event", { p_event_id: eventId });
  if (error) return { error: "We couldn't register you just now. Please try again." };

  const result = data as { status: string; booking_id?: string } | null;

  if (result?.status === "not_authenticated") {
    return { signIn: true, error: "Sign in or create a free account to hold your place." };
  }

  if (result?.status === "ok") {
    revalidatePath(`/events/${slug}`);
    revalidatePath("/account/bookings");
    return {
      success: "Your place is confirmed. Your ticket is on its way to your inbox.",
      bookingId: result.booking_id,
    };
  }

  return { error: MESSAGES[result?.status ?? "not_found"] ?? MESSAGES.not_found };
}

export async function joinWaitlistAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const { eventId, slug } = read(formData);
  if (!eventId || !slug) return { error: MESSAGES.not_found };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_event_waitlist", { p_event_id: eventId });
  if (error) return { error: "We couldn't add you just now. Please try again." };

  const result = data as { status: string; position?: number } | null;

  if (result?.status === "not_authenticated") {
    return { signIn: true, error: "Sign in or create a free account to join the waiting list." };
  }

  if (result?.status === "ok") {
    revalidatePath(`/events/${slug}`);
    return {
      success: `You're on the waiting list${result.position ? `, number ${result.position}` : ""}. If a place opens, we will email you straight away.`,
    };
  }

  return { error: MESSAGES[result?.status ?? "not_found"] ?? MESSAGES.not_found };
}

export async function leaveWaitlistAction(formData: FormData): Promise<void> {
  const { eventId, slug } = read(formData);
  if (!eventId) return;
  const supabase = await createClient();
  await supabase.rpc("leave_event_waitlist", { p_event_id: eventId });
  if (slug) revalidatePath(`/events/${slug}`);
}
