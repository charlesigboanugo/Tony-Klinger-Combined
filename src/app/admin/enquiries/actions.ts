"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["new", "read", "replied", "spam"] as const;

/**
 * Mark an enquiry — migration 0005's `contact_messages` policies.
 *
 * Written through the caller's own session, so RLS (`users.update`) is the
 * enforcement and the permission check here is the courtesy in front of it.
 */
export async function setEnquiryStatusAction(formData: FormData) {
  await requirePermission("users.update", "/admin/enquiries");
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const supabase = await createClient();
  await supabase.from("contact_messages").update({ status }).eq("id", id);
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin");
}
