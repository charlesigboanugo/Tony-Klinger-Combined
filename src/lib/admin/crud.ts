import "server-only";

import { videoIdFromInput } from "@/lib/academy/video";
import { isUserColumn, userIdForEmail } from "@/lib/admin/operations";
import { queueEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncProductToStripe } from "@/lib/stripe/sync";
import { mediaUsage } from "@/lib/admin/media-usage";
import { removeMediaFile } from "@/lib/storage/remove";
import { placeMediaFile, undoPlaceMediaFile } from "@/lib/storage/visibility";
import { getAuthContext } from "@/lib/permissions";
import {
  applyProductLink,
  checkProductLink,
  productLinkOptions,
  productLinkValues,
  VIRTUAL_PRODUCT_FIELDS,
  type ProductLinkPlan,
} from "@/lib/admin/product-links";
import type { MediaOption } from "@/components/admin/MediaPicker";
import { isPast, type Field, type ResourceConfig } from "@/lib/admin/resources";

/**
 * Generic admin CRUD — note 06 §2, §14, §16, note 08 §61.
 *
 * These run through the SERVICE ROLE, which bypasses RLS, because an operator
 * legitimately writes across all customers. RLS is therefore NOT the backstop
 * here — the permission check in this file is the only thing between a caller
 * and the data, which is why every function re-checks rather than trusting that
 * the page did.
 *
 * MFA IS PART OF THE CHECK. A staff session that has not presented its second
 * factor holds no permissions at all (note 06 §21), so `can()` returning false
 * covers both "wrong role" and "not yet stepped up".
 */

export type CrudResult = { ok: true; id?: string } | { ok: false; error: string };

async function authorize(permission: string): Promise<string | null> {
  const context = await getAuthContext();
  if (!context) return null;
  if (context.mfaRequired) return null;
  return context.permissions.has(permission) ? context.userId : null;
}

/**
 * Turn form input into column values.
 *
 * Every value arrives as a string, so each field type is converted explicitly.
 * AN EMPTY STRING BECOMES NULL rather than '': a blank date or number would
 * otherwise fail its column type, and a blank text field would store an empty
 * string that reads as "set to nothing" instead of "not set".
 */
export function parseFields(
  fields: readonly Field[],
  formData: FormData,
  /** Saving an existing row: fields fixed once created are left as they are. */
  updating = false,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.readOnly) continue;
    // Locked after creation, so ignored on save even if a value is sent.
    if (updating && field.fixedOnceCreated) continue;

    const raw = formData.get(field.name);

    // An unchecked checkbox submits nothing at all, which is false — not
    // "leave unchanged". Handled before the null check below.
    if (field.type === "boolean") {
      values[field.name] = raw === "on" || raw === "true";
      continue;
    }

    if (raw === null) continue;
    // Browsers send a text box's line breaks as \r\n; stored as \n, so text
    // saved from admin matches the imported lessons byte for byte.
    const text = raw.toString().replace(/\r\n?/g, "\n").trim();

    if (text === "") {
      values[field.name] = null;
      continue;
    }

    switch (field.type) {
      case "number":
      case "money": {
        const n = Number(text);
        values[field.name] = Number.isFinite(n) ? n : null;
        break;
      }
      case "tags":
        // Normalised again by a database trigger, so a stray space here cannot
        // split one curated collection in two (migration 0006_public_content_and_benefits).
        values[field.name] = text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        break;
      case "date":
      case "datetime":
        values[field.name] = new Date(text).toISOString();
        break;
      case "media":
        // A resource id, or null when the image was removed — handled by the
        // empty-string branch above. Stored verbatim; it is a uuid, not text
        // to be parsed.
        values[field.name] = text;
        break;
      default:
        // Named clean-ups, resolved here because `Field` cannot carry a
        // function through to the client component that renders it.
        values[field.name] =
          field.normalise === "video-id"
            ? videoIdFromInput(text)
            : field.normalise === "code"
              ? text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "")
              : text;
    }
  }

  return values;
}

/**
 * A required field sent empty, by its label, or null.
 *
 * The form marks these `required`, but the browser check is a convenience,
 * not a guarantee: a description left blank would publish a page with nothing
 * for search results or shared links to show. Only fields that were sent are
 * judged, so a form that leaves a field out (a finished row's locked inputs)
 * is not refused for it.
 */
function emptyRequired(fields: readonly Field[], formData: FormData, values: Record<string, unknown>): string | null {
  const empty = fields.find(
    (f) => f.required && f.type !== "boolean" && formData.has(f.name) && f.name in values && values[f.name] == null,
  );
  return empty ? `${empty.label} is required.` : null;
}

/** Record who changed what. An admin action nobody can trace is not accountable. */
async function audit(
  actorId: string,
  action: string,
  resource: ResourceConfig,
  rowId: string | undefined,
  detail: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_user_id: actorId,
    action,
    resource_type: resource.table,
    resource_id: rowId ?? null,
    // The submitted values, not the whole row: enough to see what was intended
    // without copying the entire record into the log on every edit.
    metadata: detail,
  });
}


/**
 * Push a product or price to Stripe the moment it is saved.
 *
 * Without this, a product is purchasable before Stripe knows about it, and
 * every sale until the next scheduled sync creates an anonymous throwaway
 * Product — which destroys per-product reporting and cannot be repaired
 * afterwards.
 *
 * Awaited rather than fired and forgotten: the operator should see the failure
 * on the form, not discover it in a log a week later. It never throws.
 */
async function syncIfCommercial(
  resource: ResourceConfig,
  rowId: string | undefined,
  values: Record<string, unknown>,
): Promise<void> {
  if (resource.table === "products" && rowId) {
    await syncProductToStripe(rowId);
    return;
  }

  if (resource.table === "prices") {
    // A price row names its product; that is what Stripe needs to attach to.
    // On an edit the form may not resubmit product_id, so it is read back from
    // the row rather than assumed present.
    let productId = values.product_id;

    if (typeof productId !== "string" && rowId) {
      const { data } = await createAdminClient()
        .from("prices")
        .select("product_id")
        .eq("id", rowId)
        .maybeSingle();
      productId = (data as { product_id?: string } | null)?.product_id;
    }

    if (typeof productId === "string") await syncProductToStripe(productId);
  }
}

/** Every column, plus the related row that decides when it finished, if any. */
function rowColumns(resource: ResourceConfig): string {
  return resource.past?.embed ? `*,${resource.past.embed}` : "*";
}

/** Parent tables whose rows finish, read by `finishedParents`. */
const DATED_PARENTS = new Set(["coaching_runs", "cohort_intakes", "retreat_batches"]);

/**
 * The ids of the finished parents this list groups by, so an empty heading
 * for a finished intake or run is not shown under Current. The parent is the
 * one a place or registration finishes with (`past.embed`), or the run or
 * intake a session or workshop is grouped under (owner, 2026-10-14: finished
 * runs were showing as empty headings in Coaching sessions).
 */
export async function finishedParents(resource: ResourceConfig): Promise<Set<string>> {
  const embed = resource.past?.embed;
  const grouped = resource.groupBy
    ? resource.fields.find((f) => f.name === resource.groupBy)?.references?.table
    : undefined;
  const table = embed ? embed.slice(0, embed.indexOf("(")) : grouped && DATED_PARENTS.has(grouped) ? grouped : null;
  if (!table) return new Set();
  const { data } = await createAdminClient()
    .from(table as "cohort_intakes")
    .select("id,ends_at,starts_at")
    .limit(1000);
  const now = Date.now();
  return new Set(
    ((data ?? []) as Array<{ id: string; ends_at: string | null; starts_at: string | null }>)
      .filter((r) => {
        const end = r.ends_at ?? r.starts_at;
        return end ? new Date(end).getTime() <= now : false;
      })
      .map((r) => r.id),
  );
}

/**
 * The parents that have no group yet (`emptyParents`): a retreat with no
 * batch, a series with no run, a cohort with no intake.
 */
export async function parentsWithoutGroups(resource: ResourceConfig): Promise<Array<{ id: string; label: string }>> {
  const cfg = resource.emptyParents;
  if (!cfg) return [];
  const admin = createAdminClient();
  let parents = admin.from(cfg.table as "retreats").select(`id,${cfg.label}`).limit(500);
  if (cfg.where) parents = parents.eq(cfg.where.column as "id", cfg.where.value as string);
  const [{ data: rows }, { data: children }] = await Promise.all([
    parents,
    admin.from(cfg.childTable as "retreat_batches").select(cfg.childKey).limit(5000),
  ]);
  const used = new Set(((children ?? []) as unknown as Array<Record<string, string>>).map((c) => c[cfg.childKey]));
  return ((rows ?? []) as unknown as Array<Record<string, string>>)
    .filter((r) => !used.has(r.id))
    .map((r) => ({ id: r.id, label: r[cfg.label] }));
}

export async function listRows(
  resource: ResourceConfig,
  limit = 200,
): Promise<Array<Record<string, unknown>>> {
  const admin = createAdminClient();
  const order = resource.orderBy ?? { column: "created_at", ascending: false };

  const { data, error } = await admin
    .from(resource.table)
    .select(rowColumns(resource))
    .order(order.column, { ascending: order.ascending ?? false })
    .limit(limit);

  if (error) {
    console.error("admin list failed", { table: resource.table, message: error.message });
    return [];
  }
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

/**
 * The Media library, for `media` fields: the kinds the form's fields accept,
 * newest first (owner, 2026-10-15).
 *
 * An image only from a public bucket: one the site cannot display is not a
 * valid choice for a cover, and offering it would produce a silently blank
 * page. A recording may be private, since it is played through a signed link.
 * Fetched once per form rather than per field.
 */
export async function listMedia(kinds: readonly string[]): Promise<MediaOption[]> {
  if (kinds.length === 0) return [];
  const { data } = await createAdminClient()
    .from("resources")
    .select("id,title,storage_path,resource_type")
    .in("resource_type", [...kinds])
    .order("created_at", { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as Array<{ id: string; title: string; storage_path: string | null; resource_type: string }>;
  return rows.flatMap((row) => {
    const isPublic = Boolean(row.storage_path && /^(site-media|avatars)\//.test(row.storage_path));
    if (row.resource_type === "image" && !isPublic) return [];
    return [
      {
        id: row.id,
        title: row.title,
        // A path only where there is a picture to show.
        storage_path: row.resource_type === "image" ? row.storage_path : null,
        kind: row.resource_type,
        isPrivate: Boolean(row.storage_path) && !isPublic,
      },
    ];
  });
}

export type ReferenceOptions = Record<
  string,
  Array<{ id: string; label: string }>
>;

/**
 * Options for every `reference` field on a resource — note 06 §16.
 *
 * Read with the service role, like the rest of this module, because an operator
 * choosing a parent row legitimately sees across content the public site would
 * not show them — an unpublished course still needs modules attaching to it.
 *
 * `context` is appended after an em dash where a label alone is ambiguous: two
 * courses can both have a module called "Introduction", and picking the wrong
 * parent is a mistake nothing later will flag.
 */
export async function listReferences(
  resource: ResourceConfig,
  /**
   * For a create or edit form (and the row being edited): a product's "what
   * it sells" choices then list only what has no product yet.
   */
  form?: { rowId?: string },
): Promise<ReferenceOptions> {
  if (resource.table === "products" && form) {
    const [all, links] = await Promise.all([listReferences(resource), productLinkOptions(form.rowId)]);
    return { ...all, ...links };
  }

  const fields = resource.fields.filter(
    (field) => field.type === "reference" && field.references,
  );
  if (fields.length === 0) return {};

  const admin = createAdminClient();

  const entries = await Promise.all(
    fields.map(async (field) => {
      const ref = field.references!;
      const value = ref.value ?? "id";
      const columns = [
        ...new Set([value, ref.label, ref.context].filter(Boolean)),
        // "!inner" when the parent filters, so rows without a matching parent
        // drop out rather than coming back with an empty parent.
        ...(ref.parent ? [`${ref.parent.relation}${ref.parent.where ? "!inner" : ""}(${ref.parent.label})`] : []),
      ].join(",");

      let query = admin
        .from(ref.table)
        .select(columns)
        .order(ref.orderBy ?? ref.label, { ascending: true })
        .limit(500);
      if (ref.parent?.where) query = query.eq(`${ref.parent.relation}.${ref.parent.where.column}`, ref.parent.where.value);
      const { data } = await query;

      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

      return [
        field.name,
        rows.map((row) => {
          const own = String(row[ref.label] ?? "Untitled");
          const context = ref.context ? row[ref.context] : null;
          const parentRow = ref.parent ? (row[ref.parent.relation] as Record<string, unknown> | null) : null;
          const parent = parentRow ? parentRow[ref.parent!.label] : null;
          const label = parent ? `${own} (${String(parent)})` : own;
          return {
            id: String(row[value]),
            label: context ? `${label} — ${String(context)}` : label,
          };
        }),
      ] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function getRow(
  resource: ResourceConfig,
  id: string,
): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data } = await admin.from(resource.table).select(rowColumns(resource)).eq("id", id).maybeSingle();
  const row = (data as unknown as Record<string, unknown> | null) ?? null;
  // What a product sells is stored on the thing it sells; read back so the
  // form opens on it.
  if (row && resource.table === "products") return { ...row, ...(await productLinkValues(row)) };
  return row;
}

/**
 * For a product: check what the form says it sells, and take the fields that
 * are not columns out of `values`. Returns the message to show, or the link
 * to write once the product is saved.
 */
async function prepareProductLink(
  resource: ResourceConfig,
  values: Record<string, unknown>,
  productId?: string,
): Promise<{ error: string } | { plan: ProductLinkPlan }> {
  if (resource.table !== "products") return { plan: null };
  let type = values.product_type;
  if (productId) {
    // The type is fixed once created, so an edit does not send it.
    const { data } = await createAdminClient().from("products").select("product_type").eq("id", productId).maybeSingle();
    type = data?.product_type;
  }
  const result = await checkProductLink(String(type ?? ""), values, productId);
  for (const name of VIRTUAL_PRODUCT_FIELDS) delete values[name];
  return result;
}

/**
 * Turn an email typed into an account field into that account's id.
 *
 * The forms show and accept the customer's email (note 10 §32.0); the tables
 * store the account's id. An id is still accepted as it is. Returns the
 * message to show if the address belongs to nobody.
 */
async function resolveCustomers(values: Record<string, unknown>): Promise<string | null> {
  for (const [name, value] of Object.entries(values)) {
    if (!isUserColumn(name) || typeof value !== "string" || !value.includes("@")) continue;
    const id = await userIdForEmail(value);
    if (!id) return `No account has the email address ${value.trim()}. The person needs an account first.`;
    values[name] = id;
  }
  return null;
}

/**
 * Fill the fields a resource derives from another (`derive`): a workshop's
 * cohort from its intake. Read from the database, so it is always the parent
 * the chosen row really has.
 */
async function applyDerived(resource: ResourceConfig, values: Record<string, unknown>): Promise<void> {
  for (const [field, rule] of Object.entries(resource.derive ?? {})) {
    const source = values[rule.from];
    if (typeof source !== "string" || !source) continue;
    const { data } = await createAdminClient()
      .from(rule.table as "cohort_intakes")
      .select(rule.column)
      .eq("id", source)
      .maybeSingle();
    const derived = (data as Record<string, unknown> | null)?.[rule.column];
    if (derived !== undefined && derived !== null) values[field] = derived;
  }
}

/**
 * Tell an applicant where their application stands — migrations 0032 and 0034
 * (owner, 2026-10-14). Approved: they can book. Declined or withdrawn: one
 * email for both, with the staff note if there is one, saying they can apply
 * again.
 *
 * Sent once per change: the key carries the moment it was approved or closed,
 * so saving the application again does not send it twice, while approving or
 * closing it afresh does. A note added after closing is therefore not sent.
 */
async function notifyRetreatApplicant(applicationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("retreat_applications")
    .select("user_id,approved_at,closed_at,staff_note,status,retreat_batches(label),retreats(name,slug)")
    .eq("id", applicationId)
    .maybeSingle();
  const row = data as unknown as {
    user_id: string;
    approved_at: string | null;
    closed_at: string | null;
    staff_note: string | null;
    status: string;
    retreat_batches: { label: string } | null;
    retreats: { name: string; slug: string } | null;
  } | null;
  if (!row) return;
  const approved = row.status === "approved" && row.approved_at;
  const closed = (row.status === "declined" || row.status === "withdrawn") && row.closed_at;
  if (!approved && !closed) return;
  const { data: account } = await admin.auth.admin.getUserById(row.user_id);
  const email = account.user?.email;
  if (!email) return;
  const details = {
    retreat: row.retreats?.name ?? "the retreat",
    batch: row.retreat_batches?.label ?? "",
    slug: row.retreats?.slug ?? "",
  };
  await queueEmail(
    approved
      ? {
          idempotencyKey: `retreat-approved:${applicationId}:${row.approved_at}`,
          template: "retreat_application_approved",
          to: email,
          payload: details,
        }
      : {
          idempotencyKey: `retreat-closed:${applicationId}:${row.closed_at}`,
          template: "retreat_application_closed",
          to: email,
          payload: { ...details, note: row.staff_note ?? "" },
        },
  );
}

/**
 * Fill any slug left empty from the row's name or title.
 *
 * Creating: made unique within the table by adding -2, -3, … , since two rows
 * can share a name but never a slug. Editing: an empty slug keeps the one
 * already stored, because a changed slug breaks every existing link.
 */
async function fillSlugs(
  resource: ResourceConfig,
  values: Record<string, unknown>,
  updating: boolean,
): Promise<void> {
  for (const field of resource.fields) {
    if (field.type !== "slug" || values[field.name] != null) continue;
    if (updating) {
      delete values[field.name];
      continue;
    }

    const source = values.name ?? values.title;
    const base =
      (typeof source === "string" ? source : "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || resource.labelSingular.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const { data: taken } = await createAdminClient()
      .from(resource.table as "products")
      .select(field.name as "slug")
      .like(field.name as "slug", `${base}%`);
    const used = new Set(((taken ?? []) as unknown as Array<Record<string, string>>).map((row) => row[field.name]));
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    values[field.name] = slug;
  }
}

/**
 * A `position` left empty (owner, 2026-10-15).
 *
 * Creating: last among its siblings where the resource names them
 * (`appendPosition`), otherwise the column's own default. Editing: the stored
 * position is kept. Without this an empty position was sent as null, which the
 * column refuses, and the save failed with a database message.
 */
async function fillPosition(
  resource: ResourceConfig,
  values: Record<string, unknown>,
  updating: boolean,
): Promise<void> {
  if (!resource.fields.some((f) => f.name === "position") || values.position != null) return;
  delete values.position;
  if (updating || !resource.appendPosition) return;

  const parent = values[resource.appendPosition];
  if (typeof parent !== "string" || !parent) return;
  const { data } = await createAdminClient()
    .from(resource.table as "lessons")
    .select("position")
    .eq(resource.appendPosition as "module_id", parent)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data as { position: number } | null)?.position;
  values.position = typeof last === "number" ? last + 1 : 1;
}

/**
 * The database's refusal, in words an operator can act on where one is known.
 *
 * Raw messages are otherwise shown as they are (staff-only surface), but these
 * name a constraint, not what to do about it.
 */
function saveError(error: { message: string }): string {
  if (error.message.includes("resources_have_a_location")) {
    return "Upload the file, or give the link, before saving.";
  }
  if (error.message.includes("products_live_name_key")) {
    return "A product on sale already has this name. Choose a different name, or archive the other product first.";
  }
  return error.message;
}

export async function createRow(
  resource: ResourceConfig,
  formData: FormData,
): Promise<CrudResult> {
  const actorId = await authorize(resource.permissions.write);
  if (!actorId) return { ok: false, error: "You do not have permission to do that." };

  const values = parseFields(resource.fields, formData);
  const missing = emptyRequired(resource.fields, formData, values);
  if (missing) return { ok: false, error: missing };
  await fillSlugs(resource, values, false);
  await fillPosition(resource, values, false);
  const unknownCustomer = await resolveCustomers(values);
  if (unknownCustomer) return { ok: false, error: unknownCustomer };
  await applyDerived(resource, values);
  const audited = { ...values };
  const link = await prepareProductLink(resource, values);
  if ("error" in link) return { ok: false, error: link.error };

  // A Media file whose "Anyone can open it" changed after it was uploaded
  // moves to match (`visibility.ts`).
  const placed =
    resource.table === "resources" && typeof values.storage_path === "string"
      ? await placeMediaFile({
          path: values.storage_path,
          kind: String(values.resource_type ?? ""),
          visibility: formData.get("__visibility")?.toString(),
        })
      : undefined;
  if (placed && !placed.ok) return { ok: false, error: placed.error };
  if (placed?.moved) values.storage_path = audited.storage_path = placed.path;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(resource.table)
    .insert(values)
    .select("id")
    .single();

  if (error) {
    await undoPlaceMediaFile(placed?.moved);
    // The database message is shown here deliberately: this is a staff-only
    // surface, and "duplicate key value violates unique constraint" tells an
    // operator exactly what to fix, where a generic message would not.
    return { ok: false, error: saveError(error) };
  }

  const id = (data as { id: string }).id;
  const linkError = await applyProductLink(id, link.plan);
  await audit(actorId, `${resource.table}.create`, resource, id, audited);
  if (linkError) return { ok: false, error: `The product was created, but linking it failed: ${linkError}` };
  if (resource.table === "retreat_applications") {
    await notifyRetreatApplicant(id);
  }
  await syncIfCommercial(resource, id, values);
  return { ok: true, id };
}

/** Whether the stored row has finished, for resources that have a `past`. */
async function finishedRow(resource: ResourceConfig, id: string): Promise<boolean> {
  if (!resource.past) return false;
  const { data } = await createAdminClient()
    .from(resource.table)
    .select(resource.past.embed ?? resource.past.columns.join(","))
    .eq("id", id)
    .maybeSingle();
  return data ? isPast(resource, data as unknown as Record<string, unknown>) : false;
}

export async function updateRow(
  resource: ResourceConfig,
  id: string,
  formData: FormData,
): Promise<CrudResult> {
  const actorId = await authorize(resource.permissions.write);
  if (!actorId) return { ok: false, error: "You do not have permission to do that." };

  let values = parseFields(resource.fields, formData, true);

  // A finished row is read-only apart from what is meant to change afterwards
  // (a recording). Checked against the row as stored, not as the form sent it.
  const finished = await finishedRow(resource, id);
  if (finished) {
    const allowed = resource.past?.stillEditable ?? [];
    values = Object.fromEntries(Object.entries(values).filter(([name]) => allowed.includes(name)));
    if (Object.keys(values).length === 0) {
      return { ok: false, error: `This ${resource.labelSingular.toLowerCase()} has finished, so it can no longer be changed.` };
    }
  }

  const missing = emptyRequired(resource.fields, formData, values);
  if (missing) return { ok: false, error: missing };
  await fillSlugs(resource, values, true);
  await fillPosition(resource, values, true);

  const unknownCustomer = await resolveCustomers(values);
  if (unknownCustomer) return { ok: false, error: unknownCustomer };
  await applyDerived(resource, values);

  // Publishing can be a separate permission from editing, so that editorial
  // approval can be required where the domain wants it (note 06 §18). Checked
  // only when the value is actually changing to published.
  if (resource.permissions.publish && values.status === "published") {
    const publisher = await authorize(resource.permissions.publish);
    if (!publisher) {
      return { ok: false, error: "You can edit this, but not publish it." };
    }
  }

  const audited = { ...values };
  const link = await prepareProductLink(resource, values, id);
  if ("error" in link) return { ok: false, error: link.error };

  const admin = createAdminClient();

  // A Media item given a new file: the old one is removed once the save holds.
  let replacedPath: string | null = null;
  let moved: { from: string; to: string } | undefined;
  if (resource.table === "resources" && typeof values.storage_path === "string") {
    const { data } = await admin.from("resources").select("storage_path,resource_type").eq("id", id).maybeSingle();
    const stored = data as { storage_path: string | null; resource_type: string } | null;
    const before = stored?.storage_path ?? null;
    if (before && before !== values.storage_path) replacedPath = before;

    // "Anyone can open it" changed: the file moves to match (`visibility.ts`).
    const placed = await placeMediaFile({
      path: values.storage_path,
      kind: stored?.resource_type ?? "",
      visibility: formData.get("__visibility")?.toString(),
      rowId: id,
    });
    if (!placed.ok) return { ok: false, error: placed.error };
    if (placed.moved) {
      values.storage_path = audited.storage_path = placed.path;
      moved = placed.moved;
    }
  }

  const { error } = await admin.from(resource.table).update(values).eq("id", id);

  if (error) {
    await undoPlaceMediaFile(moved);
    return { ok: false, error: saveError(error) };
  }
  await removeMediaFile(replacedPath);

  const linkError = await applyProductLink(id, link.plan);
  await audit(actorId, `${resource.table}.update`, resource, id, audited);
  if (linkError) return { ok: false, error: `Saved, but linking the product failed: ${linkError}` };
  await syncIfCommercial(resource, id, values);
  if (resource.table === "retreat_applications") {
    await notifyRetreatApplicant(id);
  }
  return { ok: true, id };
}

export async function deleteRow(
  resource: ResourceConfig,
  id: string,
): Promise<CrudResult> {
  // Falls back to the write permission only when no separate delete permission
  // exists. It never falls back to "allowed".
  const permission = resource.permissions.remove ?? resource.permissions.write;
  const actorId = await authorize(permission);
  if (!actorId) return { ok: false, error: "You do not have permission to do that." };

  if (await finishedRow(resource, id)) {
    return { ok: false, error: `This ${resource.labelSingular.toLowerCase()} has finished, so it is kept as a record.` };
  }

  const admin = createAdminClient();

  // A Media item takes its file with it, so one still in use is refused rather
  // than leaving a page without its image (owner, 2026-10-15).
  let mediaPath: string | null = null;
  if (resource.table === "resources") {
    const usage = await mediaUsage(id);
    if (usage.length > 0) {
      return { ok: false, error: `This media item is still used as ${usage.join("; ")}. Remove it there first.` };
    }
    const { data } = await admin.from("resources").select("storage_path").eq("id", id).maybeSingle();
    mediaPath = (data as { storage_path: string | null } | null)?.storage_path ?? null;
  }

  const { error } = await admin.from(resource.table).delete().eq("id", id);

  if (error) {
    // A foreign key violation here is the database refusing to orphan an order
    // or an entitlement. Surfaced as-is so the operator can see what depends on
    // it rather than being told "could not delete".
    return { ok: false, error: error.message };
  }

  await audit(actorId, `${resource.table}.delete`, resource, id, mediaPath ? { storage_path: mediaPath } : {});
  await removeMediaFile(mediaPath);
  return { ok: true };
}
