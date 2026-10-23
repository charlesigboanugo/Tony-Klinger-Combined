"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Take a paid place on an intake of a cohort — migration 0017.
 *
 * The browser names the intake. That the caller has paid for that cohort, that
 * registration is open, that there is still a place and that they are not
 * already on another intake of it are decided in the database, in one
 * transaction (`enrol_in_intake`).
 */
export type EnrolState = { error?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES: Record<string, string> = {
  not_authenticated: "Please sign in again.",
  not_found: "That intake is no longer available.",
  not_open: "Registration for that intake has not opened yet.",
  closed: "That intake has already started. Please choose another.",
  full: "The last place on that intake has just been taken. Please choose another.",
  cohort_taken: "You are already on an intake of this cohort.",
  no_place: "You have no paid place for this cohort.",
};

export async function enrolInIntakeAction(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const intakeId = formData.get("intake")?.toString() ?? "";
  if (!UUID.test(intakeId)) return { error: MESSAGES.not_found };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enrol_in_intake", { p_intake_id: intakeId });
  if (error) return { error: "We couldn't add you to that intake. Please try again." };

  const status = (data as { status?: string } | null)?.status;
  if (status === "ok" || status === "already") {
    revalidatePath("/academy");
    revalidatePath("/academy/cohorts");
    return { ok: true };
  }
  return { error: MESSAGES[status ?? "not_found"] ?? MESSAGES.not_found };
}
