"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Take a paid place on a run of a series — migration 0016.
 *
 * The browser names the run. That the caller has paid for that series, that
 * registration is open, that there is still a place and that they are not
 * already on another run of it are all decided in the database, in one
 * transaction (`register_for_run`).
 */
export type RegisterState = { error?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES: Record<string, string> = {
  not_authenticated: "Please sign in again.",
  not_found: "Those dates are no longer available.",
  not_open: "Registration for those dates has not opened yet.",
  closed: "That series has already started. Please choose other dates.",
  full: "The last place on those dates has just been taken. Please choose other dates.",
  series_taken: "You are already registered for this series.",
  no_pass: "You have no paid place for this series.",
  limit_reached: "You have taken all the series your pass includes this year.",
};

export async function registerForRunAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const runId = formData.get("run")?.toString() ?? "";
  if (!UUID.test(runId)) return { error: MESSAGES.not_found };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_run", { p_run_id: runId });
  if (error) return { error: "We couldn't register you. Please try again." };

  const status = (data as { status?: string } | null)?.status;
  if (status === "ok" || status === "already") {
    revalidatePath("/academy");
    revalidatePath("/academy/coaching");
    revalidatePath("/academy/pass");
    return { ok: true };
  }
  return { error: MESSAGES[status ?? "not_found"] ?? MESSAGES.not_found };
}
