"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/permissions";
import { syncZoom } from "@/lib/zoom/sync";

/** Admin → Zoom: run the `zoom-sync` job now, rather than waiting up to five minutes. */
export async function syncAllZoomAction(): Promise<void> {
  await requirePermission("coaching.read", "/admin/zoom");
  const result = await syncZoom();
  const failed = "errors" in result ? result.errors.length : 0;

  revalidatePath("/admin/zoom");
  redirect(`/admin/zoom?synced=${failed ? "with-errors" : "ok"}`);
}
