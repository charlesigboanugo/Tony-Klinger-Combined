"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * A member chooses their playlist — migrations 0012, 0018.
 *
 * The browser names the playlist and nothing else. Whether the caller is a
 * member, whether their tier lets them choose one, whether they have a choice
 * left and whether the playlist is within their tier are all decided in the
 * database (`choose_playlist`), in one transaction, so two tabs cannot each be
 * told "you have one left".
 *
 * (A series is not chosen here: a member registers for a run of it, with
 * `registerForRunAction` in academy/coaching.)
 */
export type ChoiceState = { error?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES: Record<string, string> = {
  not_authenticated: "Please sign in again.",
  no_membership: "You need a Coaching Pass to choose.",
  not_found: "That is no longer available to choose.",
  not_allowed: "That playlist is not part of your pass.",
  limit_reached: "You have already made your choice. To change it, please get in touch.",
  invalid: "Something was missing from that request. Please try again.",
};

export async function choosePlaylistAction(_prev: ChoiceState, formData: FormData): Promise<ChoiceState> {
  const id = formData.get("id")?.toString();
  if (!id || !UUID.test(id)) return { error: MESSAGES.invalid };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("choose_playlist", { p_playlist_id: id });
  if (error) return { error: "We couldn't save that choice. Please try again." };

  const status = (data as { status?: string } | null)?.status;
  // `already` and `included` mean the member holds it either way.
  if (status === "ok" || status === "already" || status === "included") {
    revalidatePath("/academy");
    revalidatePath("/academy/pass");
    revalidatePath("/academy/playlists");
    return { ok: true };
  }
  return { error: MESSAGES[status ?? "invalid"] ?? MESSAGES.invalid };
}
