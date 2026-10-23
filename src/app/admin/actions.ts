"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listHref, withFrom } from "@/lib/admin/back";
import { createRow, deleteRow, updateRow } from "@/lib/admin/crud";
import { accountDeletionBlockers, userIdForEmail } from "@/lib/admin/operations";
import { COUNTED_KINDS, isGrantableKind } from "@/lib/admin/entitlement-products";
import { resourceBySlug } from "@/lib/admin/resources";
import { UPLOADS_FOLDER } from "@/lib/storage/remove";
import { bucketFor, extensionsFor, isUploadKind, MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/lib/storage/upload-kinds";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requirePermission } from "@/lib/permissions";
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

  // Public pages are pre-built (note 10 §47.1); any content edit rebuilds them
  // now rather than at the hourly refresh. The sitemap is a metadata route
  // outside the layout tree, so it is named explicitly.
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  // redirect() throws, so it is called outside any try/catch. Back to the
  // list as it was left: the same tab, search and page.
  redirect(listHref(resource.slug, formData.get("__from")?.toString()));
}

export async function deleteResourceAction(formData: FormData) {
  const slug = formData.get("__resource")?.toString() ?? "";
  const id = formData.get("__id")?.toString();
  const from = formData.get("__from")?.toString();

  const resource = resourceBySlug(slug);
  if (!resource || !id) return;

  const result = await deleteRow(resource, id);
  if (!result.ok) {
    // Back to the item, with the reason shown there: a refusal (still in use,
    // still depended on) is an ordinary outcome, not a crash, and the person
    // who pressed Delete needs to see why nothing happened.
    redirect(withFrom(`/admin/${resource.slug}/${id}?deleteError=${encodeURIComponent(result.error)}`, from));
  }

  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  redirect(listHref(resource.slug, from));
}

/**
 * A one-time link to upload one file to Media (owner, 2026-10-15).
 *
 * The file goes from the browser STRAIGHT TO STORAGE with this link, not
 * through this server: a server action takes about 1 MB by default and a
 * hosted function about 4.5 MB, and a recording runs to 50 MB. The link is
 * good for one path only and expires on its own, so issuing it is the
 * permission check: the same one that saving a Media item needs.
 *
 * The path is made here, never taken from the browser: a random prefix (no
 * two uploads collide, and storage has no rename) and a cleaned filename.
 */
export type MediaUploadTicket =
  | { ok: true; bucket: string; path: string; token: string }
  | { ok: false; error: string };

export async function prepareMediaUploadAction(input: {
  kind: string;
  visibility: string;
  filename: string;
  size: number;
}): Promise<MediaUploadTicket> {
  const context = await getAuthContext();
  const resource = resourceBySlug("media");
  if (!context || context.mfaRequired || !resource || !context.permissions.has(resource.permissions.write)) {
    return { ok: false, error: "You do not have permission to upload media." };
  }

  if (!isUploadKind(input.kind)) return { ok: false, error: "Choose the type first." };
  const types = UPLOAD_TYPES[input.kind];

  const dot = input.filename.lastIndexOf(".");
  const ext = dot > 0 ? input.filename.slice(dot + 1).toLowerCase() : "";
  const contentType = types[ext];
  if (!contentType) {
    return { ok: false, error: `That file type is not accepted here. Use ${extensionsFor(input.kind)}.` };
  }
  if (!(input.size > 0) || input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "The file must be 50 MB or smaller." };
  }

  const stem =
    input.filename
      .slice(0, dot)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || input.kind;
  // Under `uploads/`, the only folder the abandoned-upload cleanup looks in.
  const path = `${UPLOADS_FOLDER}/${crypto.randomUUID().slice(0, 8)}-${stem}.${ext}`;
  const bucket = bucketFor(input.kind, input.visibility === "public" ? "public" : "private");

  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("media upload link failed", { bucket, message: error?.message });
    return { ok: false, error: "The upload could not be started. Try again." };
  }

  return { ok: true, bucket, path, token: data.token };
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
  // Staff type the customer's email (owner, 2026-10-13); an account id is
  // still accepted, so an old bookmark or script keeps working.
  const customer = formData.get("userId")?.toString().trim();
  // Checked BEFORE the lookup. The grant itself is authorized in the database,
  // but the lookup runs with the service role, and without this anyone able to
  // call the action could ask whether an address has an account.
  const context = await getAuthContext();
  if (!context?.permissions.has("entitlements.grant")) {
    return { error: "You do not have permission to grant access." };
  }
  const userId = customer?.includes("@") ? await userIdForEmail(customer) : customer;
  if (customer?.includes("@") && !userId) {
    return { error: `No account has the email address ${customer}. The person needs an account first.` };
  }
  // What to give arrives as `kind:id`, picked by name (owner, 2026-10-15).
  // Checked against the kinds that may be granted, never trusted as sent.
  const item = formData.get("item")?.toString().trim() ?? "";
  const split = item.indexOf(":");
  const resourceType = split > 0 ? item.slice(0, split) : "";
  const resourceId = split > 0 ? item.slice(split + 1) : "";
  const reason = formData.get("reason")?.toString().trim();
  const quantityRaw = formData.get("quantity")?.toString().trim();
  const expiresRaw = formData.get("expiresAt")?.toString().trim();

  if (!userId || !reason) {
    return { error: "The customer's email and a reason are both required." };
  }
  if (!isGrantableKind(resourceType) || !/^[0-9a-f-]{36}$/i.test(resourceId)) {
    return { error: "Choose what to give from the list." };
  }
  // A number of sessions only for what is held as sessions; anything else is
  // plain access, whatever the form sent.
  const counted = (COUNTED_KINDS as readonly string[]).includes(resourceType);
  const quantity = counted ? Number(quantityRaw) : null;
  if (counted && !(Number.isInteger(quantity) && (quantity ?? 0) >= 1)) {
    return { error: "Give the number of sessions, 1 or more." };
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
    p_quantity: quantity,
    p_expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
  });

  if (error) {
    // Staff-only surface: the database message names the missing permission or
    // the absent second factor, which is exactly what the operator needs.
    return { error: error.message };
  }

  revalidatePath("/admin/entitlements", "layout");
  return { success: "Entitlement granted and recorded in the audit log." };
}

/**
 * The entitlement a revoke or adjust names, read fresh rather than trusted
 * from the page — note 06 §23.1.
 *
 * Refuses what comes WITH a Coaching Pass (a membership-sourced series,
 * playlist or retreat row): `sync_membership_entitlements` rewrites those from
 * the pass whenever it changes, so ending or changing one by hand would be
 * quietly undone. The pass itself is what to revoke or adjust.
 */
async function entitlementToChange(id: string | undefined) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "No entitlement was named." } as const;
  const { data } = await createAdminClient()
    .from("entitlements")
    .select("id,user_id,resource_type,source_type,source_id,status,quantity,quantity_used,expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "That entitlement no longer exists." } as const;
  if (data.source_type === "membership" && data.source_id && data.resource_type !== "membership") {
    return { error: "This comes with their Coaching Pass. Revoke or change the pass instead." } as const;
  }
  return { row: data } as const;
}

function refreshEntitlement(userId: string) {
  revalidatePath("/admin/entitlements", "layout");
  revalidatePath(`/admin/users/${userId}`);
}

/** End an entitlement before its natural end. History is kept: the row is marked revoked. */
export async function revokeEntitlementAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const context = await getAuthContext();
  if (!context?.permissions.has("entitlements.revoke")) {
    return { error: "You do not have permission to revoke access." };
  }
  const reason = formData.get("reason")?.toString().trim();
  if (!reason) return { error: "A reason is required. It is recorded in the audit log." };

  const found = await entitlementToChange(formData.get("entitlementId")?.toString());
  if ("error" in found) return { error: found.error };
  if (found.row.status !== "active") return { error: "This access has already ended." };

  // The operator's own session: the function checks their permission and
  // second factor and records them as the actor.
  const { data, error } = await (await createClient()).rpc("admin_revoke_entitlement", {
    p_entitlement_id: found.row.id,
    p_reason: reason,
  });
  if (error) return { error: error.message };
  if ((data as { status?: string } | null)?.status === "not_found") {
    return { error: "That entitlement no longer exists." };
  }

  refreshEntitlement(found.row.user_id);
  return { success: "Access revoked and recorded in the audit log." };
}

/** "2026-10-31" as picked, to the last minute of that day in the UK, whatever the server's zone. */
function ukEndOfDay(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59);
  const shown = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(asUtc));
  const part = (t: string) => Number(shown.find((p) => p.type === t)?.value);
  const londonAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return new Date(asUtc - (londonAsUtc - asUtc)).toISOString();
}

/**
 * Change how many sessions an entitlement holds, or when it ends — note 06
 * §23.1, its own permission (`entitlements.adjust`). Only what was changed is
 * sent; `admin_adjust_entitlement` keeps the rest, and turns a used-up
 * entitlement back on when sessions are added.
 */
export async function adjustEntitlementAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const context = await getAuthContext();
  if (!context?.permissions.has("entitlements.adjust")) {
    return { error: "You do not have permission to change access." };
  }
  const found = await entitlementToChange(formData.get("entitlementId")?.toString());
  if ("error" in found) return { error: found.error };
  const row = found.row;
  if (row.status !== "active" && row.status !== "consumed") return { error: "This access has ended and cannot be changed." };

  const quantityRaw = formData.get("quantity")?.toString().trim();
  const endsRaw = formData.get("expiresAt")?.toString().trim();

  let quantity: number | null = null;
  if (row.quantity != null && quantityRaw) {
    const n = Number(quantityRaw);
    if (!Number.isInteger(n) || n < Math.max(1, row.quantity_used)) {
      return { error: `Sessions in total must be a whole number, at least ${Math.max(1, row.quantity_used)} (the number already used).` };
    }
    if (n !== row.quantity) quantity = n;
  }

  let expiresAt: string | null = null;
  if (endsRaw) {
    const iso = ukEndOfDay(endsRaw);
    if (!iso) return { error: "Choose an end date from the calendar." };
    if (+new Date(iso) <= Date.now()) return { error: "The end date must be today or later. To end it now, revoke it." };
    if (!row.expires_at || ukEndOfDay(new Date(row.expires_at).toLocaleDateString("en-CA", { timeZone: "Europe/London" })) !== iso) {
      expiresAt = iso;
    }
  }

  if (quantity == null && expiresAt == null) return { success: "Nothing to change." };
  const reason = formData.get("reason")?.toString().trim();
  if (!reason) return { error: "A reason is required. It is recorded in the audit log." };

  const { data, error } = await (await createClient()).rpc("admin_adjust_entitlement", {
    p_entitlement_id: row.id,
    p_reason: reason,
    p_quantity: quantity ?? undefined,
    p_expires_at: expiresAt ?? undefined,
  });
  if (error) return { error: error.message };
  if ((data as { status?: string } | null)?.status === "not_found") {
    return { error: "That entitlement no longer exists." };
  }

  refreshEntitlement(row.user_id);
  return { success: "Access changed and recorded in the audit log." };
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
/**
 * Save a person's roles as a whole — note 06 §13.1.
 *
 * The form lets staff add and remove roles in a list and save once (owner,
 * 2026-10-14). This compares the list sent with what the person holds NOW, in
 * the database rather than as the page last saw it, and makes each difference
 * through `admin_set_role`, the same audited, permission-checked function as
 * before, with the one reason given for all of them. It stops at the first
 * refusal and says what was done before it.
 */
export async function saveRolesAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const userId = formData.get("userId")?.toString().trim();
  const wanted = [...new Set(formData.getAll("roles").map((r) => r.toString().trim()).filter(Boolean))];
  const reason = formData.get("reason")?.toString().trim();
  if (!userId) return { error: "No account was named." };

  const { data: rows } = await createAdminClient().from("user_roles").select("roles(name)").eq("user_id", userId);
  const held = ((rows ?? []) as unknown as Array<{ roles: { name: string } | null }>)
    .map((r) => r.roles?.name)
    .filter((n): n is string => Boolean(n));

  const changes = [
    ...wanted.filter((r) => !held.includes(r)).map((role) => ({ role, grant: true })),
    ...held.filter((r) => !wanted.includes(r)).map((role) => ({ role, grant: false })),
  ];
  if (changes.length === 0) return { success: "Nothing to change." };
  if (!reason) return { error: "A reason is required. It is recorded in the audit log against each change." };

  // The operator's own session: `admin_set_role` checks their permission and
  // second factor and records them as the actor.
  const supabase = await createClient();
  const done: string[] = [];
  const words = (c: { role: string; grant: boolean }) => `${c.grant ? "granted" : "revoked"} ${c.role.replace(/_/g, " ")}`;

  for (const change of changes) {
    const { data, error } = await supabase.rpc("admin_set_role", {
      p_user_id: userId,
      p_role_name: change.role,
      p_grant: change.grant,
      p_reason: reason,
    });
    const refused = error?.message ?? ((data as { status?: string } | null)?.status === "unknown_role" ? `No such role: ${change.role}.` : null);
    if (refused) {
      revalidatePath(`/admin/users/${userId}`);
      return {
        error: `Could not ${change.grant ? "grant" : "revoke"} ${change.role.replace(/_/g, " ")}: ${refused}${done.length ? ` Already ${done.join(", ")}.` : " Nothing was changed."}`,
      };
    }
    done.push(words(change));
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/roles");
  const list = done.join(", ");
  return { success: `${list.charAt(0).toUpperCase()}${list.slice(1)}. Recorded in the audit log.` };
}

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
      The link lands on the password form, where a password is OPTIONAL
      (owner, 2026-10-23): accepting confirms the address, so the person can
      sign in again with an email link or Google. The form says so and offers
      "Skip for now".
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
 * accident `ON DELETE SET NULL` was chosen to avoid in migration 0006_public_content_and_benefits.
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

/**
 * Delete a person's account — note 06 §14.4.
 *
 * Permanent, so it is guarded three ways: the `users.delete` permission
 * (owners and admins, migration 0028), a written reason, and `accountDeletionBlockers`, which is
 * checked again here rather than trusted from the page, so an account that
 * gained a booking or a payment since the page loaded is still refused. Staff
 * cannot delete their own account from here.
 *
 * The audit entry is written FIRST, with the email, because deleting the
 * account removes the only other record of who it was.
 */
export async function deleteUserAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const userId = formData.get("userId")?.toString().trim();
  const reason = formData.get("reason")?.toString().trim();
  if (!userId) return { error: "No account was named." };
  if (!reason) return { error: "A reason is required. It is recorded in the audit log." };

  const context = await requirePermission("users.delete", `/admin/users/${userId}`);
  if (context.userId === userId) return { error: "You cannot delete your own account from here." };

  const blockers = await accountDeletionBlockers(userId);
  if (blockers.length) return { error: `This account cannot be deleted yet. ${blockers.join(" ")}` };

  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(userId);
  if (!found.user) return { error: "That account no longer exists." };

  const { error: logError } = await admin.from("audit_logs").insert({
    actor_user_id: context.userId,
    action: "users.delete",
    resource_type: "users",
    resource_id: userId,
    reason,
    metadata: { email: found.user.email ?? null },
  });
  if (logError) return { error: `Not deleted: the audit entry could not be written (${logError.message}).` };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: `Not deleted: ${error.message}` };

  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

