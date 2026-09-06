"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createRow, deleteRow, updateRow } from "@/lib/admin/crud";
import { resourceBySlug } from "@/lib/admin/resources";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { absoluteUrl } from "@/lib/urls";

/**
 * Admin form actions — note 06 §2.
 *
 * The resource slug arrives from a hidden form field, so it is treated as
 * untrusted input and resolved against the declared registry. An unknown slug
 * is refused rather than used to build a query — otherwise this would be an
 * arbitrary-table write endpoint for anyone who could post to it.
 *
 * `createRow`/`updateRow`/`deleteRow` each re-check the permission themselves;
 * nothing here assumes the caller reached this page legitimately.
 */
export type AdminFormState = { error?: string };

export async function saveResourceAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const slug = formData.get("__resource")?.toString() ?? "";
  const id = formData.get("__id")?.toString();

  const resource = resourceBySlug(slug);
  if (!resource) return { error: "Unknown resource." };

  const result = id
    ? await updateRow(resource, id, formData)
    : await createRow(resource, formData);

  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/${resource.slug}`);
  // redirect() throws, so it is called outside any try/catch.
  redirect(`/admin/${resource.slug}`);
}

export async function deleteResourceAction(formData: FormData) {
  const slug = formData.get("__resource")?.toString() ?? "";
  const id = formData.get("__id")?.toString();

  const resource = resourceBySlug(slug);
  if (!resource || !id) return;

  const result = await deleteRow(resource, id);
  if (!result.ok) {
    // Surfaced on the next render via the list page rather than thrown: a
    // foreign-key refusal is an ordinary outcome, not a crash.
    console.error("admin delete refused", { table: resource.table, error: result.error });
  }

  revalidatePath(`/admin/${resource.slug}`);
  redirect(`/admin/${resource.slug}`);
}

/**
 * Manual entitlement grant — note 06 §23.1, note 07 §29.
 *
 * RESTORED after being overwritten. A grant is a privileged act that hands
 * somebody paid-for access without a payment, so it is deliberately narrower
 * than the generic CRUD above: it goes through `admin_grant_entitlement`, which
 * enforces the permission, requires a second factor, and REQUIRES A REASON —
 * an unexplained grant is indistinguishable from a mistake or an abuse of
 * privilege, and the reason is what makes the audit trail worth having.
 */
export type AdminState = { error?: string; success?: string };

export async function grantEntitlementAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = formData.get("userId")?.toString().trim();
  const resourceType = formData.get("resourceType")?.toString().trim();
  const resourceId = formData.get("resourceId")?.toString().trim() || null;
  const reason = formData.get("reason")?.toString().trim();
  const quantityRaw = formData.get("quantity")?.toString().trim();
  const expiresRaw = formData.get("expiresAt")?.toString().trim();

  if (!userId || !resourceType || !reason) {
    return { error: "Customer, resource type and reason are all required." };
  }

  // The user's own session, NOT the service role: `admin_grant_entitlement`
  // reads auth.uid() to check the permission and the assurance level, and a
  // service-role call would present no user to check.
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_grant_entitlement", {
    p_user_id: userId,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_reason: reason,
    p_quantity: quantityRaw ? Number(quantityRaw) : null,
    p_expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
  });

  if (error) {
    // Staff-only surface: the database message names the missing permission or
    // the absent second factor, which is exactly what the operator needs.
    return { error: error.message };
  }

  revalidatePath("/admin/entitlements");
  return { success: "Entitlement granted and recorded in the audit log." };
}

/**
 * Grant or revoke a staff role — note 06 §13, §13.1, §34.
 *
 * Deliberately the same shape as the entitlement grant above, for the same
 * reason: this hands somebody the ability to act on the platform, so it runs
 * through `admin_set_role` — which checks the permission, requires a second
 * factor, refuses to let a non-owner confer `owner`, and writes the audit
 * entry — rather than through the generic CRUD path.
 *
 * A REASON IS REQUIRED. The database column is nullable and the RPC would
 * accept a null, but a role change with no explanation is indistinguishable
 * from a mistake or an abuse of privilege, and the explanation is the whole
 * value of the audit trail.
 */
export async function setRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = formData.get("userId")?.toString().trim();
  const role = formData.get("role")?.toString().trim();
  const grant = formData.get("grant")?.toString() === "grant";
  const reason = formData.get("reason")?.toString().trim();

  if (!userId || !role || !reason) {
    return { error: "Role and reason are both required." };
  }

  // The operator's own session, not the service role: `admin_set_role` reads
  // auth.uid() for the permission check, the assurance level and the audit
  // entry's actor. A service-role call would present nobody to record.
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_set_role", {
    p_user_id: userId,
    p_role_name: role,
    p_grant: grant,
    p_reason: reason,
  });

  if (error) return { error: error.message };

  // The function reports an unknown role in its RESULT rather than as an
  // error, so a silent no-op is possible unless the payload is read.
  if ((data as { status?: string } | null)?.status === "unknown_role") {
    return { error: `No such role: ${role}.` };
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/roles");

  return {
    success: grant
      ? `Granted ${role.replace(/_/g, " ")}, recorded in the audit log.`
      : `Revoked ${role.replace(/_/g, " ")}, recorded in the audit log.`,
  };
}

/**
 * Invite somebody to hold an account — note 06 §14.2.
 *
 * AN INVITATION, NOT A CREATED PASSWORD. An administrator who sets someone's
 * first password knows their credential, and the account stops being provably
 * theirs — which is the property note 05 §11.1 exists to protect. The invitee
 * proves control of the mailbox and chooses their own secret.
 *
 * The order of operations matters and is deliberate:
 *
 *   1. permission + second factor, in the application
 *   2. the invitation itself, which is a GoTrue admin call, not SQL
 *   3. the audit entry, which re-checks BOTH in the database
 *
 * Step 3 can only fail if step 1 was somehow wrong, and an account created
 * without a record of who created it is exactly the thing an audit log exists
 * to prevent — so that case removes the account it just made rather than
 * leaving an unattributable principal in the system.
 */
export async function inviteUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const displayName = formData.get("displayName")?.toString().trim();
  const reason = formData.get("reason")?.toString().trim();

  if (!email || !reason) {
    return { error: "Email address and reason are both required." };
  }

  // Refuses, and redirects to the second factor, before anything is created.
  await requirePermission("users.invite", "/admin/users");

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    /*
      Accepting an invitation means SETTING A PASSWORD, so the link lands on
      the form that does it. Without the `next`, the callback would establish a
      session and drop the new person on /account holding no credential of
      their own — able to use the site once, and unable to sign in again.
    */
    redirectTo: absoluteUrl(
      `/auth/callback?next=${encodeURIComponent("/auth/reset-password?invited=1")}`,
    ),
    data: displayName ? { display_name: displayName } : undefined,
  });

  if (error) {
    // The common case is an address that already has an account, which is not
    // a failure worth a stack trace — it is an answer.
    return {
      error: /already|registered|exists/i.test(error.message)
        ? "That address already has an account. Open it from the list below."
        : error.message,
    };
  }

  const invited = data.user;

  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("admin_record_user_invite", {
    p_user_id: invited.id,
    p_email: email,
    p_reason: reason,
  });

  if (auditError) {
    await admin.auth.admin.deleteUser(invited.id);
    return {
      error: `The invitation was withdrawn because it could not be recorded: ${auditError.message}`,
    };
  }

  revalidatePath("/admin/users");

  return {
    success: `Invitation sent to ${email}. They set their own password from the link.`,
  };
}

/**
 * Put somebody on the public team page, or take them off — note 06 §14.1.
 *
 * Team membership is a PRESENTATION choice, not a role: it grants nothing, and
 * a staff role does not put anyone on the page. The two are administered
 * separately and this action touches only the first.
 *
 * Three modes, because three genuinely different things can be meant:
 *
 *   create   this user has no public entry; make one
 *   link     an entry already exists for this person and was never connected to
 *            an account — the five seeded biographies are all like this
 *   remove   unlink, WITHOUT deleting the entry
 *
 * `remove` unlinks rather than deletes deliberately. A published biography is
 * content, and losing it because somebody's staff status changed is exactly the
 * accident `ON DELETE SET NULL` was chosen to avoid in migration 0034.
 *
 * LINKING IS NEVER INFERRED. An existing entry is connected only because an
 * operator picked it: matching a display name against a biography's name would
 * quietly attach one person's orders and entitlements to another person's
 * public identity.
 */
export async function teamMembershipAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = formData.get("userId")?.toString().trim();
  const mode = formData.get("mode")?.toString();

  if (!userId) return { error: "No account given." };

  await requirePermission("users.update", `/admin/users/${userId}`);

  const admin = createAdminClient();
  const revalidate = () => {
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/team");
    revalidatePath("/about/team");
  };

  if (mode === "remove") {
    const { error } = await admin
      .from("team_members")
      .update({ user_id: null })
      .eq("user_id", userId);

    if (error) return { error: error.message };

    revalidate();
    return {
      success:
        "Unlinked from the account. The public entry is untouched — remove it from Team if it should no longer appear.",
    };
  }

  if (mode === "link") {
    const teamMemberId = formData.get("teamMemberId")?.toString().trim();
    if (!teamMemberId) return { error: "Choose an existing entry to link." };

    const { error } = await admin
      .from("team_members")
      .update({ user_id: userId })
      .eq("id", teamMemberId)
      .is("user_id", null);

    if (error) {
      return {
        error: /unique|duplicate/i.test(error.message)
          ? "That entry is already linked to another account."
          : error.message,
      };
    }

    revalidate();
    return { success: "Linked to the existing team entry." };
  }

  // create
  const name = formData.get("name")?.toString().trim();
  const role = formData.get("role")?.toString().trim() || null;
  const publish = formData.get("publish") === "on";

  if (!name) return { error: "A name is required — it is what the site shows." };

  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "team-member";

  // A name collision is ordinary — two people can share one — so the slug is
  // made unique rather than the insert being allowed to fail on it.
  const { data: taken } = await admin
    .from("team_members")
    .select("slug")
    .like("slug", `${base}%`);

  const used = new Set((taken ?? []).map((row) => row.slug as string));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

  const { error } = await admin.from("team_members").insert({
    user_id: userId,
    name,
    slug,
    role,
    status: publish ? "published" : "draft",
  });

  if (error) {
    return {
      error: /unique|duplicate/i.test(error.message)
        ? "This account is already on the team page."
        : error.message,
    };
  }

  revalidate();

  return {
    success: publish
      ? "Added to the team page. Add a photo and biography from Team."
      : "Team entry created as a draft. Publish it from Team when it is ready.",
  };
}

/**
 * Clear somebody's security keys so they can register again — note 05 §11.1.
 *
 * The lever the documented recovery story always assumed. It matters more now
 * that a customer who registers a key is asked for it at sign-in: losing that
 * key means losing the account until somebody here does this.
 *
 * The DECISION is made in the database (`admin_record_mfa_reset`), not here —
 * who may clear whose keys is a rule, and a rule that lives only in a Server
 * Action is a rule that a second Server Action can forget. It is called BEFORE
 * anything is destroyed, so a refusal arrives while there is still something to
 * refuse.
 */
export async function resetMfaAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = formData.get("userId")?.toString().trim();
  const reason = formData.get("reason")?.toString().trim();

  if (!userId) return { error: "No account given." };
  if (!reason) return { error: "A reason is required." };

  await requirePermission("users.reset_mfa", `/admin/users/${userId}`);

  const supabase = await createClient();
  const { error: refusal } = await supabase.rpc("admin_record_mfa_reset", {
    p_user_id: userId,
    p_reason: reason,
  });

  if (refusal) return { error: refusal.message };

  const admin = createAdminClient();
  const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId,
  });

  if (listError) return { error: listError.message };

  const removed = factors?.factors ?? [];
  for (const factor of removed) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({
      userId,
      id: factor.id,
    });
    // Reported rather than swallowed: a PARTIAL reset leaves the person still
    // locked out while the audit log says they were helped.
    if (error) {
      return {
        error: `Removed some keys, then failed on “${factor.friendly_name ?? factor.id}”: ${error.message}`,
      };
    }
  }

  revalidatePath(`/admin/users/${userId}`);

  return {
    success:
      removed.length === 0
        ? "That account had no keys to clear."
        : `Cleared ${removed.length} key${removed.length === 1 ? "" : "s"}. They can register a new one next time they sign in.`,
  };
}
