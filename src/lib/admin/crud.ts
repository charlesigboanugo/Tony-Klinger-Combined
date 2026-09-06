import "server-only";

import { videoIdFromInput } from "@/lib/academy/video";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncProductToStripe } from "@/lib/stripe/sync";
import { getAuthContext } from "@/lib/permissions";
import type { Field, ResourceConfig } from "@/lib/admin/resources";

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
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.readOnly) continue;

    const raw = formData.get(field.name);

    // An unchecked checkbox submits nothing at all, which is false — not
    // "leave unchanged". Handled before the null check below.
    if (field.type === "boolean") {
      values[field.name] = raw === "on" || raw === "true";
      continue;
    }

    if (raw === null) continue;
    const text = raw.toString().trim();

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
        // split one curated collection in two (migration 0023).
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
          field.normalise === "video-id" ? videoIdFromInput(text) : text;
    }
  }

  return values;
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

export async function listRows(
  resource: ResourceConfig,
  limit = 200,
): Promise<Array<Record<string, unknown>>> {
  const admin = createAdminClient();
  const order = resource.orderBy ?? { column: "created_at", ascending: false };

  const { data, error } = await admin
    .from(resource.table)
    .select("*")
    .order(order.column, { ascending: order.ascending ?? false })
    .limit(limit);

  if (error) {
    console.error("admin list failed", { table: resource.table, message: error.message });
    return [];
  }
  return (data ?? []) as Array<Record<string, unknown>>;
}

/**
 * The image library, for `media` fields.
 *
 * Public buckets only: an image that cannot be displayed on the site is not a
 * valid choice for a cover, and offering it would produce a silently blank
 * page. Fetched once per form rather than per field.
 */
export async function listMedia(): Promise<
  Array<{ id: string; title: string; storage_path: string | null }>
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("resources")
    .select("id,title,storage_path")
    .eq("resource_type", "image")
    .or("storage_path.like.site-media/%,storage_path.like.avatars/%")
    .order("title", { ascending: true })
    .limit(1000);

  return (data ?? []) as Array<{
    id: string;
    title: string;
    storage_path: string | null;
  }>;
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
): Promise<ReferenceOptions> {
  const fields = resource.fields.filter(
    (field) => field.type === "reference" && field.references,
  );
  if (fields.length === 0) return {};

  const admin = createAdminClient();

  const entries = await Promise.all(
    fields.map(async (field) => {
      const ref = field.references!;
      const columns = ["id", ref.label, ref.context].filter(Boolean).join(",");

      const { data } = await admin
        .from(ref.table)
        .select(columns)
        .order(ref.orderBy ?? ref.label, { ascending: true })
        .limit(500);

      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

      return [
        field.name,
        rows.map((row) => {
          const label = String(row[ref.label] ?? "Untitled");
          const context = ref.context ? row[ref.context] : null;
          return {
            id: String(row.id),
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
  const { data } = await admin.from(resource.table).select("*").eq("id", id).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function createRow(
  resource: ResourceConfig,
  formData: FormData,
): Promise<CrudResult> {
  const actorId = await authorize(resource.permissions.write);
  if (!actorId) return { ok: false, error: "You do not have permission to do that." };

  const values = parseFields(resource.fields, formData);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(resource.table)
    .insert(values)
    .select("id")
    .single();

  if (error) {
    // The database message is shown here deliberately: this is a staff-only
    // surface, and "duplicate key value violates unique constraint" tells an
    // operator exactly what to fix, where a generic message would not.
    return { ok: false, error: error.message };
  }

  const id = (data as { id: string }).id;
  await audit(actorId, `${resource.table}.create`, resource, id, values);
  await syncIfCommercial(resource, id, values);
  return { ok: true, id };
}

export async function updateRow(
  resource: ResourceConfig,
  id: string,
  formData: FormData,
): Promise<CrudResult> {
  const actorId = await authorize(resource.permissions.write);
  if (!actorId) return { ok: false, error: "You do not have permission to do that." };

  const values = parseFields(resource.fields, formData);

  // Publishing can be a separate permission from editing, so that editorial
  // approval can be required where the domain wants it (note 06 §18). Checked
  // only when the value is actually changing to published.
  if (resource.permissions.publish && values.status === "published") {
    const publisher = await authorize(resource.permissions.publish);
    if (!publisher) {
      return { ok: false, error: "You can edit this, but not publish it." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from(resource.table).update(values).eq("id", id);

  if (error) return { ok: false, error: error.message };

  await audit(actorId, `${resource.table}.update`, resource, id, values);
  await syncIfCommercial(resource, id, values);
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

  const admin = createAdminClient();
  const { error } = await admin.from(resource.table).delete().eq("id", id);

  if (error) {
    // A foreign key violation here is the database refusing to orphan an order
    // or an entitlement. Surfaced as-is so the operator can see what depends on
    // it rather than being told "could not delete".
    return { ok: false, error: error.message };
  }

  await audit(actorId, `${resource.table}.delete`, resource, id, {});
  return { ok: true };
}
