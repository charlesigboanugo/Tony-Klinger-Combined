"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Event-day actions — migration 0018.
 *
 * Checked twice: `requirePermission` here, and `check_in_ticket` refuses
 * anyone without `events.update` in the database as well.
 */

const REFERENCE = /^TK-[23456789A-HJKMNP-Z]{8}$/;

function normalise(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  // Accept the code typed without its prefix.
  return value.startsWith("TK-") ? value : `TK-${value}`;
}

/** Check a ticket in (or undo), then return to where the button was pressed. */
export async function checkInAction(formData: FormData): Promise<void> {
  await requirePermission("events.update", "/admin/check-in");
  const reference = normalise(formData.get("reference"));
  const undo = formData.get("undo") === "1";
  const back = String(formData.get("back") ?? "");

  const supabase = await createClient();
  const { data } = await supabase.rpc("check_in_ticket", { p_reference: reference, p_undo: undo });
  const result = (data ?? { status: "not_found" }) as { status: string; eventId?: string };

  revalidatePath("/admin/check-in");
  if (back === "list" && result.eventId) {
    redirect(`/admin/check-in?event=${result.eventId}&done=${result.status}&ref=${reference}`);
  }
  redirect(`/admin/check-in/${reference}?done=${result.status}`);
}

/** Save an online event's private joining link and notes. */
export async function saveJoiningAction(formData: FormData): Promise<void> {
  await requirePermission("events.update", "/admin/check-in");
  const eventId = String(formData.get("eventId") ?? "");
  const joinUrl = String(formData.get("joinUrl") ?? "").trim();
  const notes = String(formData.get("joiningNotes") ?? "").trim();

  let valid = joinUrl === "";
  try {
    valid = valid || ["https:", "http:"].includes(new URL(joinUrl).protocol);
  } catch {
    valid = false;
  }
  if (!eventId || !valid) redirect(`/admin/check-in?event=${eventId}&joining=invalid`);

  const supabase = await createClient();
  const { error } = await supabase.from("event_access").upsert({
    event_id: eventId,
    join_url: joinUrl || null,
    joining_notes: notes || null,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/admin/check-in");
  redirect(`/admin/check-in?event=${eventId}&joining=${error ? "failed" : "saved"}`);
}

export type ScanResult = {
  status: "ok" | "already" | "cancelled" | "not_found" | "wrong_event" | "invalid" | "forbidden" | "undone" | "error";
  reference?: string;
  name?: string;
  event?: string;
  checkedInAt?: string;
};

/**
 * The in-page scanner's action: check a ticket in and report back, without
 * leaving the scanning screen. Accepts what a scan yields (the ticket's
 * check-in URL) or what a person types (the code, with or without "TK-").
 *
 * When scanning for a particular event, a ticket for another event is
 * reported and NOT checked in: the wrong night's ticket must not open the
 * door just because it is genuine.
 */
export async function scanTicketAction(
  raw: string,
  eventId: string | null,
  undo = false,
): Promise<ScanResult> {
  await requirePermission("events.update", "/admin/check-in");

  const fromUrl = raw.match(/TK-[23456789A-HJKMNP-Z]{8}/i)?.[0];
  const reference = normalise(fromUrl ?? raw);
  if (!REFERENCE.test(reference)) return { status: "invalid" };

  const supabase = await createClient();

  if (eventId && !undo) {
    // Read-only, and only after the permission check: which event this ticket
    // is for. A ticket for another event is reported, never checked in.
    const admin = createAdminClient();
    const { data: booking } = await admin
      .from("bookings")
      .select("bookable_id")
      .eq("reference", reference)
      .eq("bookable_type", "event")
      .maybeSingle();
    if (!booking) return { status: "not_found", reference };
    if (booking.bookable_id !== eventId) {
      const { data: other } = await admin.from("events").select("name").eq("id", booking.bookable_id).maybeSingle();
      return { status: "wrong_event", reference, event: other?.name };
    }
  }

  const { data, error } = await supabase.rpc("check_in_ticket", { p_reference: reference, p_undo: undo });
  if (error) return { status: "error", reference };

  const result = data as { status: ScanResult["status"]; name?: string; event?: string; checkedInAt?: string };
  revalidatePath("/admin/check-in");
  return { status: result.status, reference, name: result.name, event: result.event, checkedInAt: result.checkedInAt };
}
