"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create a run of a series — migration 0016.
 *
 * A run is one running of a series: its eight weekly sessions, a registration
 * period before it and a number of places. Creating it here makes the run and
 * all its sessions from the first session's date, rather than thirty-two
 * sessions typed one at a time.
 *
 * The permission is checked here, not only on the page: the write goes through
 * the service role, so this action is the only gate (note 06 §2).
 */
export type ScheduleState = { error?: string; success?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "2026-10-13T16:00" as typed, read as UK time, to an instant.
 *
 * The form has no timezone and the server's own is not the UK's, so the offset
 * is found from what London's clock shows at that moment — correct either side
 * of a clock change.
 */
function ukLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const shown = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(asUtc));
  const part = (t: string) => Number(shown.find((p) => p.type === t)?.value);
  const londonAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return new Date(asUtc - (londonAsUtc - asUtc)).toISOString();
}

export async function scheduleSeriesAction(_prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  await requirePermission("coaching.manage", "/admin/schedule");

  const seriesId = formData.get("series")?.toString() ?? "";
  const first = ukLocalToIso(formData.get("first")?.toString() ?? "");
  const opensRaw = formData.get("opens")?.toString() ?? "";
  const opens = opensRaw ? ukLocalToIso(opensRaw) : null;
  const count = Number(formData.get("count"));
  const minutes = Number(formData.get("minutes"));
  const capacityRaw = formData.get("capacity")?.toString() ?? "";
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const label = formData.get("label")?.toString().trim() || null;
  const meetingUrl = formData.get("meeting_url")?.toString().trim() || null;

  if (!UUID.test(seriesId)) return { error: "Choose a series." };
  if (!first) return { error: "Enter the date and time of the first session." };
  if (+new Date(first) <= Date.now()) return { error: "The first session must be in the future." };
  if (opensRaw && !opens) return { error: "Enter a valid date for when registration opens, or leave it empty." };
  if (opens && +new Date(opens) >= +new Date(first)) return { error: "Registration must open before the first session." };
  if (!Number.isInteger(count) || count < 1 || count > 52) return { error: "Sessions must be a number from 1 to 52." };
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) return { error: "Length must be between 15 and 480 minutes." };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) return { error: "Places must be a whole number." };
  if (meetingUrl && !/^https:\/\//i.test(meetingUrl)) return { error: "The joining link must start with https://" };

  const { error } = await createAdminClient().rpc("schedule_series_run", {
    p_series_id: seriesId,
    p_first_start: first,
    p_count: count,
    p_minutes: minutes,
    ...(opens ? { p_registration_opens: opens } : {}),
    ...(capacity ? { p_capacity: capacity } : {}),
    ...(label ? { p_label: label } : {}),
    ...(meetingUrl ? { p_meeting_url: meetingUrl } : {}),
  });
  if (error) {
    // One run of a series takes registrations at a time (migration 0021).
    if (error.message.includes("run_already_open")) {
      return {
        error:
          "This series already has a run taking registrations. A second can be opened once that one is full or has started, or with its registration opening after the first one starts.",
      };
    }
    return { error: "The run could not be created. Please try again." };
  }

  // The series pages are pre-built; show the new dates now.
  revalidatePath("/", "layout");
  revalidatePath("/admin/schedule");

  return {
    success: `Run created with ${count} weekly session${count === 1 ? "" : "s"}. It is listed above, and its sessions are under Coaching sessions, where each can be edited.`,
  };
}
