"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AccountFormState = { error?: string; success?: string };

const profileSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  displayName: z.string().trim().min(1, "Enter a display name").max(80),
});

/**
 * Update the signed-in customer's profile — note 02 §19.
 *
 * The update is scoped to `auth.uid()` by RLS, so it cannot touch another
 * customer's row even if a user id were somehow supplied (note 08 §59).
 */
export async function updateProfileAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName")?.toString() || undefined,
    lastName: formData.get("lastName")?.toString() || undefined,
    displayName: formData.get("displayName")?.toString(),
  });

  if (!parsed.success) return { error: "Enter a display name (up to 80 characters)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName ?? null,
      last_name: parsed.data.lastName ?? null,
      display_name: parsed.data.displayName,
    })
    .eq("user_id", user.id);

  if (error) return { error: "We couldn't save those changes. Please try again." };

  revalidatePath("/account/profile");
  return { success: "Profile updated." };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check those passwords." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: "We couldn't change your password. Please try again." };

  return { success: "Password changed. Other sessions stay signed in." };
}
