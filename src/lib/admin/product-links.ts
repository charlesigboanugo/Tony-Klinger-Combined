import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What a product sells (owner, 2026-10-15).
 *
 * The thing comes first and its product second: a product is created FOR a
 * pass tier, course, cohort, retreat, event, Group Coaching series or
 * one-to-one service, chosen on the product form (required) or by starting
 * from that thing's own admin page. The choice lists only what is still
 * missing its product, so two products can never sell the same thing.
 *
 * WHERE THE LINK IS STORED is unchanged, because fulfilment reads it there:
 *   - tier, course, cohort, retreat, event: the thing's `product_id`
 *   - Group Coaching: the product's `series_id`. A series has TWO products,
 *     one session and the series (more than one session granted).
 *   - one-to-one: the service's `product_id` is its 1-session product; the
 *     pack names that product in `pack_of`. Again two products per service.
 */

type Option = { id: string; label: string };
type Row = Record<string, unknown>;

/** Things sold by exactly one product, linked by their own `product_id`. */
const SINGLE = {
  membership: { field: "sells_tier", table: "membership_tiers", label: "name", orderBy: "rank", noun: "Coaching Pass tier" },
  course: { field: "sells_course", table: "courses", label: "title", orderBy: "title", noun: "course" },
  cohort: { field: "sells_cohort", table: "cohorts", label: "name", orderBy: "rank", noun: "cohort" },
  retreat: { field: "sells_retreat", table: "retreats", label: "name", orderBy: "position", noun: "retreat" },
  event: { field: "sells_event", table: "events", label: "name", orderBy: "starts_at", noun: "event" },
} as const;

type SingleType = keyof typeof SINGLE;

/** The form field that says what each product type sells. */
export const PRODUCT_LINK_FIELD: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SINGLE).map(([type, cfg]) => [type, cfg.field])),
  group_coaching: "series_id",
  private_coaching: "sells_private",
};

/** Admin tables a product can be created from, and the product type each needs. */
export const PRODUCT_TYPE_FOR_TABLE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SINGLE).map(([type, cfg]) => [cfg.table, type])),
  group_coaching_series: "group_coaching",
  private_coaching_services: "private_coaching",
};

function isSingle(type: string): type is SingleType {
  return type in SINGLE;
}

/** More than one session granted: the series, or the one-to-one pack. */
function isMulti(credits: unknown): boolean {
  return Number(credits ?? 1) > 1;
}

function finished(row: Row, now = Date.now()): boolean {
  const end = (row.ends_at ?? row.starts_at) as string | null | undefined;
  return end ? new Date(end).getTime() <= now : false;
}

/**
 * A table named at run time from the map above. Typed as one of them (each
 * has `id` and `product_id`); every read names its columns explicitly.
 */
function from(table: string) {
  return createAdminClient().from(table as "retreats");
}

function products() {
  return createAdminClient().from("products");
}

async function rows(table: string, columns: string, orderBy: string): Promise<Row[]> {
  const { data } = await from(table).select(columns).order(orderBy, { ascending: true }).limit(1000);
  return (data ?? []) as unknown as Row[];
}

/**
 * The choices for each "what it sells" field: only things still missing a
 * product, plus whatever `productId` (the product being edited) already sells,
 * so an edit opens on its current value.
 */
export async function productLinkOptions(productId?: string): Promise<Record<string, Option[]>> {
  const options: Record<string, Option[]> = {};

  await Promise.all(
    (Object.keys(SINGLE) as SingleType[]).map(async (type) => {
      const cfg = SINGLE[type];
      const extra = type === "event" ? ",is_free,starts_at,ends_at" : "";
      const list = await rows(cfg.table, `id,${cfg.label},product_id${extra}`, cfg.orderBy);
      options[cfg.field] = list
        .filter((r) => {
          if (r.product_id === productId && productId) return true;
          if (r.product_id) return false;
          // A free event needs no ticket, and a finished one sells nothing.
          if (type === "event" && (r.is_free === true || finished(r))) return false;
          return true;
        })
        .map((r) => ({ id: String(r.id), label: String(r[cfg.label] ?? "Untitled") }));
    }),
  );

  const [series, services, coachingProducts] = await Promise.all([
    rows("group_coaching_series", "id,name", "name"),
    rows("private_coaching_services", "id,name,product_id", "name"),
    rows("products", "id,product_type,series_id,credits,pack_of", "name"),
  ]);
  const others = coachingProducts.filter((p) => p.id !== productId);

  // Group Coaching: a series is offered until it has both of its products.
  const seriesHas = new Map<string, { one: boolean; multi: boolean }>();
  for (const p of others) {
    if (p.product_type !== "group_coaching" || !p.series_id) continue;
    const has = seriesHas.get(String(p.series_id)) ?? { one: false, multi: false };
    if (isMulti(p.credits)) has.multi = true;
    else has.one = true;
    seriesHas.set(String(p.series_id), has);
  }
  options.series_id = series.flatMap((s) => {
    const has = seriesHas.get(String(s.id)) ?? { one: false, multi: false };
    if (has.one && has.multi) return [];
    const name = String(s.name ?? "Untitled");
    // Which of the two is still missing, when creating; an edit is already one of them.
    const left = productId ? "" : has.one ? " — only the series product left to add" : has.multi ? " — only the 1-session product left to add" : "";
    return [{ id: String(s.id), label: `${name}${left}` }];
  });

  // One-to-one: a service is offered until it has its 1-session product and
  // its pack. The pack can only follow the 1-session product it is a pack of.
  const packed = new Set(
    others.filter((p) => p.product_type === "private_coaching" && p.pack_of).map((p) => String(p.pack_of)),
  );
  options.sells_private = services.flatMap((s) => {
    const name = String(s.name ?? "Untitled");
    const single = s.product_id ? String(s.product_id) : null;
    if (!single || single === productId) return [{ id: String(s.id), label: name }];
    if (packed.has(single)) return [];
    return [{ id: String(s.id), label: productId ? name : `${name} — only the pack left to add` }];
  });

  return options;
}

/** What an existing product sells, as form values, so its edit form shows it. */
export async function productLinkValues(product: Row): Promise<Row> {
  const type = String(product.product_type ?? "");
  const id = String(product.id);

  if (isSingle(type)) {
    const cfg = SINGLE[type];
    const { data } = await from(cfg.table).select("id").eq("product_id", id).limit(1).maybeSingle();
    return { [cfg.field]: (data as Row | null)?.id ?? null };
  }

  if (type === "private_coaching") {
    const single = product.pack_of ? String(product.pack_of) : id;
    const { data } = await from("private_coaching_services")
      .select("id")
      .eq("product_id", single)
      .limit(1)
      .maybeSingle();
    return { sells_private: (data as Row | null)?.id ?? null };
  }

  return {};
}

/** A saved link to write once the product row exists. */
export type ProductLinkPlan = { table: string; rowId: string } | null;

/**
 * Check what the product form says it sells, before anything is written.
 *
 * Returns the message to show, or the link to write after the save. For a
 * one-to-one product it also sets `pack_of` in `values` (the pack's
 * 1-session product, or none), since that is where a pack's link lives.
 */
export async function checkProductLink(
  type: string,
  values: Row,
  productId?: string,
): Promise<{ error: string } | { plan: ProductLinkPlan }> {
  const field = PRODUCT_LINK_FIELD[type];
  if (!field) return { plan: null };
  const chosen = values[field];
  // Not sent (an edit of a finished or locked form): leave the link alone.
  if (chosen === undefined) return { plan: null };
  if (chosen === null || chosen === "") return { error: "Choose what this product sells." };
  const chosenId = String(chosen);

  if (isSingle(type)) {
    const cfg = SINGLE[type];
    const { data } = await from(cfg.table).select("id,product_id").eq("id", chosenId).maybeSingle();
    const row = data as Row | null;
    if (!row) return { error: `That ${cfg.noun} no longer exists.` };
    if (row.product_id && row.product_id !== productId) {
      return { error: `That ${cfg.noun} already has its product. Edit that product instead.` };
    }
    return { plan: { table: cfg.table, rowId: chosenId } };
  }

  if (type === "group_coaching") {
    const multi = isMulti(values.credits);
    let query = products()
      .select("id,credits")
      .eq("product_type", "group_coaching")
      .eq("series_id", chosenId);
    if (productId) query = query.neq("id", productId);
    const { data } = await query;
    const clash = ((data ?? []) as Row[]).some((p) => isMulti(p.credits) === multi);
    if (clash) {
      return {
        error: multi
          ? "That series already has its series product. Edit that product instead."
          : "That series already has its 1-session product. Edit that product instead.",
      };
    }
    return { plan: null };
  }

  if (type === "private_coaching") {
    const { data } = await from("private_coaching_services")
      .select("id,name,product_id")
      .eq("id", chosenId)
      .maybeSingle();
    const service = data as Row | null;
    if (!service) return { error: "That one-to-one service no longer exists." };
    const single = service.product_id ? String(service.product_id) : null;

    if (!isMulti(values.credits)) {
      if (single && single !== productId) {
        return { error: "That service already has its 1-session product. Edit that product instead." };
      }
      if (productId && !single) {
        // Moving a 1-session product to another service would take its pack
        // with it, under a service the pack was never sold for.
        const { data: packs } = await products().select("id").eq("pack_of", productId).limit(1);
        const { data: current } = await from("private_coaching_services")
          .select("id")
          .eq("product_id", productId)
          .limit(1);
        if ((packs ?? []).length > 0 && (current ?? []).length > 0) {
          return { error: "This product has a pack, so it stays with its service. Create a new product for the other service." };
        }
      }
      values.pack_of = null;
      return { plan: { table: "private_coaching_services", rowId: chosenId } };
    }

    if (!single) {
      return { error: `Create the 1-session product for ${String(service.name)} first. The pack is a pack of it.` };
    }
    if (single === productId) {
      return { error: "This is the service's 1-session product, so it grants 1 session." };
    }
    let packs = products().select("id").eq("pack_of", single);
    if (productId) packs = packs.neq("id", productId);
    const { data: existing } = await packs.limit(1);
    if ((existing ?? []).length > 0) {
      return { error: "That service already has its pack. Edit that product instead." };
    }
    values.pack_of = single;
    // A pack sells through its 1-session product; if it was one before, the
    // service it sold stops pointing at it.
    return { plan: { table: "private_coaching_services", rowId: "" } };
  }

  return { plan: null };
}

/**
 * Write the link once the product exists: the chosen thing names this
 * product, and anything of the same kind that named it before no longer does.
 */
export async function applyProductLink(productId: string, plan: ProductLinkPlan): Promise<string | null> {
  if (!plan) return null;
  const clear = from(plan.table).update({ product_id: null }).eq("product_id", productId);
  const { error: clearError } = await (plan.rowId ? clear.neq("id", plan.rowId) : clear);
  if (clearError) return clearError.message;
  if (!plan.rowId) return null;
  const { error } = await from(plan.table).update({ product_id: productId }).eq("id", plan.rowId);
  return error ? error.message : null;
}

/** Fields of the product form that are not columns of `products`. */
export const VIRTUAL_PRODUCT_FIELDS = new Set(
  Object.values(PRODUCT_LINK_FIELD).filter((name) => name !== "series_id"),
);

export type LinkedProducts = {
  type: string;
  products: Array<{ id: string; name: string; status: string; note?: string }>;
  /** Whether another product can still be created for it, and if not why. */
  canAdd: boolean;
  reason?: string;
};

/** The product(s) a thing is sold by, for the panel on its admin page. */
export async function linkedProducts(table: string, row: Row): Promise<LinkedProducts | null> {
  const type = PRODUCT_TYPE_FOR_TABLE[table];
  if (!type) return null;
  const id = String(row.id);
  const pick = "id,name,status,credits";
  const asItem = (p: Row, note?: string) => ({
    id: String(p.id),
    name: String(p.name ?? "Untitled"),
    status: String(p.status ?? ""),
    note,
  });

  if (type === "group_coaching") {
    const { data } = await products().select(pick).eq("series_id", id).order("credits", { ascending: true });
    const list = (data ?? []) as Row[];
    const one = list.some((p) => !isMulti(p.credits));
    const multi = list.some((p) => isMulti(p.credits));
    return {
      type,
      products: list.map((p) => asItem(p, isMulti(p.credits) ? "The series" : "1 session")),
      canAdd: !(one && multi),
      reason: one && multi ? "It has both its products: one session and the series." : undefined,
    };
  }

  if (type === "private_coaching") {
    const single = row.product_id ? String(row.product_id) : null;
    if (!single) return { type, products: [], canAdd: true };
    const { data } = await products().select(pick).or(`id.eq.${single},pack_of.eq.${single}`);
    const list = ((data ?? []) as Row[]).sort((a, b) => Number(a.credits ?? 1) - Number(b.credits ?? 1));
    const hasPack = list.some((p) => p.id !== single);
    return {
      type,
      products: list.map((p) => asItem(p, p.id === single ? "1 session" : "Pack")),
      canAdd: !hasPack,
      reason: hasPack ? "It has both its products: one session and the pack." : undefined,
    };
  }

  const list: LinkedProducts["products"] = [];
  if (row.product_id) {
    const { data } = await products().select(pick).eq("id", String(row.product_id)).maybeSingle();
    if (data) list.push(asItem(data as Row));
  }
  if (list.length > 0) return { type, products: list, canAdd: false, reason: "It has its product." };
  if (type === "event" && row.is_free === true) {
    return { type, products: list, canAdd: false, reason: "A free event needs no ticket product." };
  }
  if (type === "event" && finished(row)) {
    return { type, products: list, canAdd: false, reason: "This event has finished." };
  }
  return { type, products: list, canAdd: true };
}
